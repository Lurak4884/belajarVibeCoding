import { Elysia } from 'elysia';
import { db } from './db.js';
import { subscriptions } from './schema.js';
import { eq, or, and } from 'drizzle-orm';

const checkAuth = ({ headers, set }) => {
  const authHeader = headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    set.status = 401;
    return {
      status: "Not OK",
      message: "Unauthorized: Missing basic auth header"
    };
  }

  const base64Credentials = authHeader.substring(6);
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [clientId, clientKey] = credentials.split(':');

  const expectedClientId = process.env.AUTH_CLIENT_ID || 'mockClientId';
  const expectedClientKey = process.env.AUTH_CLIENT_KEY || 'mockClientSecret';

  if (clientId !== expectedClientId || clientKey !== expectedClientKey) {
    set.status = 401;
    return {
      status: "Not OK",
      message: "Unauthorized: Invalid credentials"
    };
  }
};

const app = new Elysia()
  .get('/', () => 'Hello World')
  .group('/api/v1/subscription', (group) =>
    group
      .onBeforeHandle(checkAuth)
      .post('/', async ({ body, set }) => {
        try {
          if (!body || !body.transactionId || !body.msisdn) {
            set.status = 400;
            return {
              status: "Not OK",
              message: "transactionId and msisdn are required"
            };
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
            return {
              status: "Not OK",
              message: "Subscription with this transactionId or msisdn already exists"
            };
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

          // Set up callback delay values
          const delayInactive = parseInt(process.env.CALLBACK_DELAY_INACTIVE || '2000', 10);
          const delayActive = parseInt(process.env.CALLBACK_DELAY_ACTIVE || '30000', 10);
          const callbackUrl = process.env.CALLBACK_URL;

          // Trigger background job (callback lifecycle)
          setTimeout(async () => {
            try {
              // Update status to inactive
              await db
                .update(subscriptions)
                .set({ subscriptionStatus: 'inactive', updatedAt: new Date().toISOString() })
                .where(eq(subscriptions.partnerSubscriptionId, transactionId));

              // Send callback first
              if (callbackUrl) {
                await fetch(callbackUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    partnerSubscriptionId: transactionId,
                    referenceId,
                    msisdn,
                    productName: productName || null,
                    subscriptionStatus: 'inactive',
                    timestamp: new Date().toISOString(),
                  }),
                }).catch((err) => console.error('Callback inactive error:', err.message));
              }

              // Trigger callback active after delayActive
              setTimeout(async () => {
                try {
                  // Update status to active
                  await db
                    .update(subscriptions)
                    .set({ subscriptionStatus: 'active', updatedAt: new Date().toISOString() })
                    .where(eq(subscriptions.partnerSubscriptionId, transactionId));

                  // Send callback second
                  if (callbackUrl) {
                    await fetch(callbackUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        partnerSubscriptionId: transactionId,
                        referenceId,
                        msisdn,
                        productName: productName || null,
                        subscriptionStatus: 'active',
                        timestamp: new Date().toISOString(),
                      }),
                    }).catch((err) => console.error('Callback active error:', err.message));
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
          return {
            status: "OK",
            message: "Subscription created successfully",
            data: {
              partnerSubscriptionId: transactionId,
              referenceId,
              msisdn
            }
          };

        } catch (error) {
          set.status = 500;
          return {
            status: "Not OK",
            message: error.message
          };
        }
      })
      .post('/check-status', async ({ body, set }) => {
        try {
          if (!body || !body.transactionId || !body.msisdn) {
            set.status = 400;
            return {
              status: "Not OK",
              message: "transactionId and msisdn are required"
            };
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
            return {
              status: "Not OK",
              message: "Subscription not found"
            };
          }

          const sub = results[0];
          return {
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

        } catch (error) {
          set.status = 500;
          return {
            status: "Not OK",
            message: error.message
          };
        }
      })
      .post('/unsubscribe', async ({ body, set }) => {
        try {
          if (!body || !body.transactionId || !body.msisdn) {
            set.status = 400;
            return {
              status: "Not OK",
              message: "transactionId and msisdn are required"
            };
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
            return {
              status: "Not OK",
              message: "Subscription not found"
            };
          }

          const sub = results[0];

          // Trigger background job for unsubscribe callback after delay
          const delayUnsubscribe = parseInt(process.env.CALLBACK_DELAY_UNSUBSCRIBE || '5000', 10);
          const callbackUrl = process.env.CALLBACK_URL;

          setTimeout(async () => {
            try {
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
                await fetch(callbackUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    partnerSubscriptionId: sub.partnerSubscriptionId,
                    referenceId: sub.referenceId,
                    msisdn: sub.msisdn,
                    productName: sub.productName,
                    subscriptionStatus: 'unsubscribe',
                    timestamp: new Date().toISOString(),
                  }),
                }).catch((err) => console.error('Callback unsubscribe error:', err.message));
              }
            } catch (err) {
              console.error('Error during unsubscribe callback status update:', err.message);
            }
          }, delayUnsubscribe);

          return {
            status: "OK",
            message: "In Progress for unsubscription",
            data: {
              partnerSubscriptionId: sub.partnerSubscriptionId,
              referenceId: sub.referenceId
            }
          };

        } catch (error) {
          set.status = 500;
          return {
            status: "Not OK",
            message: error.message
          };
        }
      })
  )
  .listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
