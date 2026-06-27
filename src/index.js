import { Elysia } from 'elysia';
import { db } from './db.js';
import { subscriptions } from './schema.js';
import { eq, or, and } from 'drizzle-orm';

const checkAuth = ({ headers, set }) => {
  const authHeader = headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    set.status = 401;
    const errRes = {
      status: "Not OK",
      message: "Unauthorized: Missing basic auth header"
    };
    console.log(`[${new Date().toISOString()}] AUTH - Failed: Missing auth header`);
    return errRes;
  }

  const base64Credentials = authHeader.substring(6);
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [clientId, clientKey] = credentials.split(':');

  const expectedClientId = process.env.AUTH_CLIENT_ID || 'mockClientId';
  const expectedClientKey = process.env.AUTH_CLIENT_KEY || 'mockClientSecret';

  if (clientId !== expectedClientId || clientKey !== expectedClientKey) {
    set.status = 401;
    const errRes = {
      status: "Not OK",
      message: "Unauthorized: Invalid credentials"
    };
    console.log(`[${new Date().toISOString()}] AUTH - Failed: Invalid credentials for clientId: ${clientId}`);
    return errRes;
  }
};

const app = new Elysia()
  .get('/', () => 'Hello World')
  .group('/api/v1/subscription', (group) =>
    group
      .onBeforeHandle(checkAuth)
      .post('/', async ({ body, set }) => {
        try {
          console.log(`[${new Date().toISOString()}] SUBSCRIBE - Request Received`);
          console.log(`Request Body: ${JSON.stringify(body, null, 2)}`);

          if (!body || !body.transactionId || !body.msisdn) {
            set.status = 400;
            const errRes = {
              status: "Not OK",
              message: "transactionId and msisdn are required"
            };
            console.log(`Response (400): ${JSON.stringify(errRes, null, 2)}`);
            return errRes;
          }

          const { transactionId, msisdn, productName } = body;

          // Check duplicate
          const existing = await db
            .select()
            .from(subscriptions)
            .where(
              or(
                eq(subscriptions.partnerSubscriptionId, transactionId),
                eq(subscriptions.msisdn, msisdn)
              )
            );

          if (existing.length > 0) {
            set.status = 409;
            const errRes = {
              status: "Not OK",
              message: "Subscription with this transactionId or msisdn already exists"
            };
            console.log(`Response (409): ${JSON.stringify(errRes, null, 2)}`);
            return errRes;
          }

          // Generate referenceId (UUID)
          const referenceId = crypto.randomUUID();

          // Save to database as pending
          await db.insert(subscriptions).values({
            partnerSubscriptionId: transactionId,
            referenceId,
            msisdn,
            productName: productName || null,
            subscriptionStatus: 'pending',
          });
          console.log(`[${new Date().toISOString()}] SUBSCRIBE - Database status set to PENDING`);

          // Set up callback delay values
          const delayInactive = parseInt(process.env.CALLBACK_DELAY_INACTIVE || '2000', 10);
          const delayActive = parseInt(process.env.CALLBACK_DELAY_ACTIVE || '30000', 10);
          const callbackUrl = process.env.CALLBACK_URL;

          // Trigger background job (callback lifecycle)
          setTimeout(async () => {
            try {
              console.log(`[${new Date().toISOString()}] CALLBACK - Updating status to INACTIVE for partnerSubscriptionId: ${transactionId}`);
              // Update status to inactive
              await db
                .update(subscriptions)
                .set({ subscriptionStatus: 'inactive', updatedAt: new Date().toISOString() })
                .where(eq(subscriptions.partnerSubscriptionId, transactionId));

              // Send callback first
              if (callbackUrl) {
                const callbackPayload = {
                  partnerSubscriptionId: transactionId,
                  referenceId,
                  msisdn,
                  productName: productName || null,
                  subscriptionStatus: 'inactive',
                  timestamp: new Date().toISOString(),
                };
                console.log(`[${new Date().toISOString()}] CALLBACK - Sending INACTIVE callback to ${callbackUrl}`);
                console.log(`Callback Payload: ${JSON.stringify(callbackPayload, null, 2)}`);

                await fetch(callbackUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(callbackPayload),
                })
                  .then(async (res) => {
                    const text = await res.text();
                    console.log(`[${new Date().toISOString()}] CALLBACK - INACTIVE callback response status: ${res.status}. Body: ${text}`);
                  })
                  .catch((err) => console.error(`[${new Date().toISOString()}] CALLBACK - INACTIVE callback failed:`, err.message));
              }

              // Trigger callback active after delayActive
              setTimeout(async () => {
                try {
                  console.log(`[${new Date().toISOString()}] CALLBACK - Updating status to ACTIVE for partnerSubscriptionId: ${transactionId}`);
                  // Update status to active
                  await db
                    .update(subscriptions)
                    .set({ subscriptionStatus: 'active', updatedAt: new Date().toISOString() })
                    .where(eq(subscriptions.partnerSubscriptionId, transactionId));

                  // Send callback second
                  if (callbackUrl) {
                    const callbackPayload = {
                      partnerSubscriptionId: transactionId,
                      referenceId,
                      msisdn,
                      productName: productName || null,
                      subscriptionStatus: 'active',
                      timestamp: new Date().toISOString(),
                    };
                    console.log(`[${new Date().toISOString()}] CALLBACK - Sending ACTIVE callback to ${callbackUrl}`);
                    console.log(`Callback Payload: ${JSON.stringify(callbackPayload, null, 2)}`);

                    await fetch(callbackUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(callbackPayload),
                    })
                      .then(async (res) => {
                        const text = await res.text();
                        console.log(`[${new Date().toISOString()}] CALLBACK - ACTIVE callback response status: ${res.status}. Body: ${text}`);
                      })
                      .catch((err) => console.error(`[${new Date().toISOString()}] CALLBACK - ACTIVE callback failed:`, err.message));
                  }
                } catch (err) {
                  console.error('Error during active callback status update:', err.message);
                }
              }, delayActive);

            } catch (err) {
              console.error('Error during inactive callback status update:', err.message);
            }
          }, delayInactive);

          set.status = 201;
          const successRes = {
            status: "OK",
            message: "Subscription created successfully",
            data: {
              partnerSubscriptionId: transactionId,
              referenceId,
              msisdn
            }
          };
          console.log(`Response (201): ${JSON.stringify(successRes, null, 2)}`);
          return successRes;

        } catch (error) {
          set.status = 500;
          const errRes = {
            status: "Not OK",
            message: error.message
          };
          console.log(`Response (500): ${JSON.stringify(errRes, null, 2)}`);
          return errRes;
        }
      })
      .post('/check-status', async ({ body, set }) => {
        try {
          console.log(`[${new Date().toISOString()}] CHECK STATUS - Request Received`);
          console.log(`Request Body: ${JSON.stringify(body, null, 2)}`);

          if (!body || !body.transactionId || !body.msisdn) {
            set.status = 400;
            const errRes = {
              status: "Not OK",
              message: "transactionId and msisdn are required"
            };
            console.log(`Response (400): ${JSON.stringify(errRes, null, 2)}`);
            return errRes;
          }

          const { transactionId, msisdn } = body;

          const results = await db
            .select()
            .from(subscriptions)
            .where(
              and(
                eq(subscriptions.partnerSubscriptionId, transactionId),
                eq(subscriptions.msisdn, msisdn)
              )
            );

          if (results.length === 0) {
            set.status = 404;
            const errRes = {
              status: "Not OK",
              message: "Subscription not found"
            };
            console.log(`Response (404): ${JSON.stringify(errRes, null, 2)}`);
            return errRes;
          }

          const sub = results[0];
          const successRes = {
            status: "OK",
            data: {
              partnerSubscriptionId: sub.partnerSubscriptionId,
              referenceId: sub.referenceId,
              msisdn: sub.msisdn,
              productName: sub.productName,
              subscriptionStatus: sub.subscriptionStatus,
              createdAt: sub.createdAt ? new Date(sub.createdAt).toISOString() : null,
              updatedAt: sub.updatedAt ? new Date(sub.updatedAt).toISOString() : null,
            }
          };
          console.log(`Response (200): ${JSON.stringify(successRes, null, 2)}`);
          return successRes;

        } catch (error) {
          set.status = 500;
          const errRes = {
            status: "Not OK",
            message: error.message
          };
          console.log(`Response (500): ${JSON.stringify(errRes, null, 2)}`);
          return errRes;
        }
      })
      .post('/unsubscribe', async ({ body, set }) => {
        try {
          console.log(`[${new Date().toISOString()}] UNSUBSCRIBE - Request Received`);
          console.log(`Request Body: ${JSON.stringify(body, null, 2)}`);

          if (!body || !body.transactionId || !body.msisdn) {
            set.status = 400;
            const errRes = {
              status: "Not OK",
              message: "transactionId and msisdn are required"
            };
            console.log(`Response (400): ${JSON.stringify(errRes, null, 2)}`);
            return errRes;
          }

          const { transactionId, msisdn } = body;

          const results = await db
            .select()
            .from(subscriptions)
            .where(
              and(
                eq(subscriptions.partnerSubscriptionId, transactionId),
                eq(subscriptions.msisdn, msisdn)
              )
            );

          if (results.length === 0) {
            set.status = 404;
            const errRes = {
              status: "Not OK",
              message: "Subscription not found"
            };
            console.log(`Response (404): ${JSON.stringify(errRes, null, 2)}`);
            return errRes;
          }

          const sub = results[0];

          // Trigger background job for unsubscribe callback after delay
          const delayUnsubscribe = parseInt(process.env.CALLBACK_DELAY_UNSUBSCRIBE || '5000', 10);
          const callbackUrl = process.env.CALLBACK_URL;

          setTimeout(async () => {
            try {
              console.log(`[${new Date().toISOString()}] CALLBACK - Updating status to UNSUBSCRIBE in database`);
              // Update status to unsubscribe in DB
              await db
                .update(subscriptions)
                .set({ subscriptionStatus: 'unsubscribe', updatedAt: new Date().toISOString() })
                .where(
                  and(
                    eq(subscriptions.partnerSubscriptionId, transactionId),
                    eq(subscriptions.msisdn, msisdn)
                  )
                );

              // Send callback
              if (callbackUrl) {
                const callbackPayload = {
                  partnerSubscriptionId: sub.partnerSubscriptionId,
                  referenceId: sub.referenceId,
                  msisdn: sub.msisdn,
                  productName: sub.productName,
                  subscriptionStatus: 'unsubscribe',
                  timestamp: new Date().toISOString(),
                };
                console.log(`[${new Date().toISOString()}] CALLBACK - Sending UNSUBSCRIBE callback to ${callbackUrl}`);
                console.log(`Callback Payload: ${JSON.stringify(callbackPayload, null, 2)}`);

                await fetch(callbackUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(callbackPayload),
                })
                  .then(async (res) => {
                    const text = await res.text();
                    console.log(`[${new Date().toISOString()}] CALLBACK - UNSUBSCRIBE callback response status: ${res.status}. Body: ${text}`);
                  })
                  .catch((err) => console.error('Callback unsubscribe error:', err.message));
              }
            } catch (err) {
              console.error('Error during unsubscribe callback status update:', err.message);
            }
          }, delayUnsubscribe);

          const successRes = {
            status: "OK",
            message: "In Progress for unsubscription",
            data: {
              partnerSubscriptionId: sub.partnerSubscriptionId,
              referenceId: sub.referenceId
            }
          };
          console.log(`Response (200): ${JSON.stringify(successRes, null, 2)}`);
          return successRes;

        } catch (error) {
          set.status = 500;
          const errRes = {
            status: "Not OK",
            message: error.message
          };
          console.log(`Response (500): ${JSON.stringify(errRes, null, 2)}`);
          return errRes;
        }
      })
  )
  .listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
