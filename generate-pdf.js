import PDFDocument from 'pdfkit';
import fs from 'fs';

const doc = new PDFDocument({ margins: { top: 50, bottom: 30, left: 50, right: 50 }, bufferPages: true });
doc.pipe(fs.createWriteStream('LutpiPlix_API_Documentation.pdf'));

// Colors
const PRIMARY = '#1e3a8a'; // Dark blue
const SECONDARY = '#475569'; // Slate
const TEXT_COLOR = '#0f172a'; // Near black
const BG_CODE = '#f8fafc'; // Very light gray
const BORDER_CODE = '#cbd5e1'; // Light gray border
const ERROR_RED = '#b91c1c'; // Red
const SUCCESS_GREEN = '#15803d'; // Green

// Helper to draw code block
function drawCodeBlock(code) {
  doc.save();
  const startY = doc.y;
  
  // Measure text height to draw background card properly
  doc.fontSize(9.5).font('Courier');
  const height = doc.heightOfString(code, { width: 490 });
  const blockHeight = height + 20;

  // Background rect
  doc.rect(50, startY, 512, blockHeight)
     .fillAndStroke(BG_CODE, BORDER_CODE);

  // Render text inside
  doc.fillColor('#0f172a')
     .text(code, 60, startY + 10, { width: 490 });
     
  doc.restore();
  doc.y = startY + blockHeight + 10;
}

// Helper for section headings
function addHeading1(text) {
  doc.moveDown(1.5);
  doc.fontSize(18).font('Helvetica-Bold').fillColor(PRIMARY).text(text);
  doc.moveTo(50, doc.y + 2).lineTo(562, doc.y + 2).strokeColor(PRIMARY).lineWidth(1.5).stroke();
  doc.moveDown(0.8);
}

function addHeading2(text) {
  doc.moveDown(1.2);
  doc.fontSize(14).font('Helvetica-Bold').fillColor(SECONDARY).text(text);
  doc.moveDown(0.5);
}

function addHeading3(text) {
  doc.moveDown(1);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(TEXT_COLOR).text(text);
  doc.moveDown(0.3);
}

function addParagraph(text) {
  doc.fontSize(10.5).font('Helvetica').fillColor(TEXT_COLOR).text(text, { align: 'justify', lineGap: 3 });
  doc.moveDown(0.5);
}

// ----------------------------------------------------
// 1. COVER PAGE (Page 1 is created automatically)
doc.rect(50, 50, 512, 692).strokeColor(PRIMARY).lineWidth(2).stroke();

doc.moveDown(8);
doc.fontSize(28).font('Helvetica-Bold').fillColor(PRIMARY).text('LutpiPlix', { align: 'center' });
doc.fontSize(22).font('Helvetica-Bold').fillColor(SECONDARY).text('Partner API Integration', { align: 'center' });
doc.fontSize(16).font('Helvetica').fillColor(TEXT_COLOR).text('Documentation & Specs', { align: 'center' });

doc.moveDown(5);
doc.moveTo(150, doc.y).lineTo(462, doc.y).strokeColor(SECONDARY).lineWidth(1).stroke();
doc.moveDown(2);

doc.fontSize(10).font('Helvetica-Bold').fillColor(SECONDARY).text('Document Version:', { align: 'center', continued: true });
doc.font('Helvetica').text(' 1.0.0', { align: 'center' });
doc.fontSize(10).font('Helvetica-Bold').fillColor(SECONDARY).text('Date:', { align: 'center', continued: true });
doc.font('Helvetica').text(' June 2026', { align: 'center' });
doc.fontSize(10).font('Helvetica-Bold').fillColor(SECONDARY).text('Owner:', { align: 'center', continued: true });
doc.font('Helvetica').text(' LutpiPlix Integration Team', { align: 'center' });

// ----------------------------------------------------
// 2. TABLE OF CONTENTS (Page 2)
// ----------------------------------------------------
doc.addPage();
addHeading1('Table of Contents');

doc.fontSize(11).font('Helvetica');
const tocItems = [
  { title: '1. Introduction & Overview', page: '3' },
  { title: '2. Authentication & Authorization', page: '3' },
  { title: '3. API Endpoints Reference', page: '4' },
  { title: '   3.1. Subscribe API (POST /api/v1/subscription)', page: '4' },
  { title: '   3.2. Check Status API (POST /api/v1/subscription/check-status)', page: '5' },
  { title: '   3.3. Unsubscribe API (POST /api/v1/subscription/unsubscribe)', page: '6' },
  { title: '4. Lifecycle Callbacks spec', page: '7' },
  { title: '   4.1. Inactive Callback', page: '7' },
  { title: '   4.2. Active Callback', page: '7' },
  { title: '   4.3. Unsubscribe Callback', page: '8' },
];

tocItems.forEach(item => {
  doc.font(item.title.startsWith(' ') ? 'Helvetica' : 'Helvetica-Bold')
     .text(item.title, { continued: true })
     .font('Helvetica')
     .text(' ' + '.'.repeat(70 - item.title.length) + ' ' + item.page, { align: 'right' });
  doc.moveDown(0.6);
});

// ----------------------------------------------------
// 3. INTRODUCTION & OVERVIEW & AUTH (Page 3)
// ----------------------------------------------------
doc.addPage();
addHeading1('1. Introduction & Overview');
addParagraph('Welcome to the LutpiPlix Partner API integration documentation. This interface allows our trusted partners to programmatically manage customer subscriptions, check status details, and handle unsubscription flows. All service flows use secure HTTP operations and support structured JSON payloads.');

addParagraph('LutpiPlix utilizes an asynchronous model for lifecycle states: once a subscription request is accepted, it initially moves to "pending", moves to "inactive" shortly after validation, and eventually transitions to "active" upon successful billing or resource provisioning. The partner will be notified of these status updates via webhook callbacks.');

addHeading1('2. Authentication & Authorization');
addParagraph('All HTTP API requests to the LutpiPlix server must contain a standard Basic Authentication header. The credentials consist of a Client ID and a Client Key provided to you during the onboarding process.');

addHeading3('Request Header Format');
drawCodeBlock('Authorization: Basic <Base64-encoded credentials>\nContent-Type: application/json');

addParagraph('Example of credentials configuration in your codebase:');
doc.fontSize(10.5).font('Helvetica-Bold').fillColor(TEXT_COLOR).text(' • Client ID: ', { continued: true }).font('Helvetica').text('Your assigned Client ID');
doc.fontSize(10.5).font('Helvetica-Bold').fillColor(TEXT_COLOR).text(' • Client Key: ', { continued: true }).font('Helvetica').text('Your assigned Client Key (Secret)');

// ----------------------------------------------------
// 4. API ENDPOINTS (Page 4)
// ----------------------------------------------------
doc.addPage();
addHeading1('3. API Endpoints Reference');
addHeading2('3.1. Subscribe API');
addParagraph('Initiates a subscription process for a user\'s MSISDN. Upon acceptance, a pending record is created, and the asynchronous callback lifecycle starts.');

doc.fontSize(10.5).font('Helvetica-Bold').fillColor(TEXT_COLOR).text(' • Method: ', { continued: true }).font('Helvetica').text('POST');
doc.fontSize(10.5).font('Helvetica-Bold').fillColor(TEXT_COLOR).text(' • URL: ', { continued: true }).font('Helvetica').text('https://<your-deployed-domain>.run.app/api/v1/subscription');
doc.fontSize(10.5).font('Helvetica-Bold').fillColor(TEXT_COLOR).text(' • Auth Required: ', { continued: true }).font('Helvetica').text('Basic Authentication');
doc.moveDown(0.5);

addHeading3('Request Body Sample (JSON)');
drawCodeBlock(JSON.stringify({
  transactionId: "TXN-20260628001",
  msisdn: "6281234567890",
  productName: "Premium Package"
}, null, 2));

addHeading3('Success Response (201 Created)');
drawCodeBlock(JSON.stringify({
  status: "OK",
  message: "Subscription created successfully",
  data: {
    partnerSubscriptionId: "TXN-20260628001",
    referenceId: "e9bb49f8-d703-4903-a1bc-7bb0b21a8d05",
    msisdn: "6281234567890"
  }
}, null, 2));

// ----------------------------------------------------
// 5. API ENDPOINTS PART 2 (Page 5)
// ----------------------------------------------------
doc.addPage();
addHeading3('Error Response - Validation Failed (400 Bad Request)');
addParagraph('Returned when required fields like transactionId or msisdn are missing in the request.');
drawCodeBlock(JSON.stringify({
  status: "Not OK",
  message: "transactionId and msisdn are required"
}, null, 2));

addHeading3('Error Response - Duplicate Transaction/MSISDN (409 Conflict)');
addParagraph('Returned if the transactionId or msisdn has already been registered in the system.');
drawCodeBlock(JSON.stringify({
  status: "Not OK",
  message: "Subscription with this transactionId or msisdn already exists"
}, null, 2));

addHeading3('Error Response - Unauthorized (401 Unauthorized)');
addParagraph('Returned when the credentials in the Authorization header are missing or invalid.');
drawCodeBlock(JSON.stringify({
  status: "Not OK",
  message: "Unauthorized: Invalid credentials"
}, null, 2));

// ----------------------------------------------------
// 6. API ENDPOINTS PART 3 (Page 6)
// ----------------------------------------------------
doc.addPage();
addHeading2('3.2. Check Status API');
addParagraph('Retrieves the current details and activation status of an existing subscription record.');

doc.fontSize(10.5).font('Helvetica-Bold').fillColor(TEXT_COLOR).text(' • Method: ', { continued: true }).font('Helvetica').text('POST');
doc.fontSize(10.5).font('Helvetica-Bold').fillColor(TEXT_COLOR).text(' • URL: ', { continued: true }).font('Helvetica').text('https://<your-deployed-domain>.run.app/api/v1/subscription/check-status');
doc.fontSize(10.5).font('Helvetica-Bold').fillColor(TEXT_COLOR).text(' • Auth Required: ', { continued: true }).font('Helvetica').text('Basic Authentication');
doc.moveDown(0.5);

addHeading3('Request Body Sample (JSON)');
drawCodeBlock(JSON.stringify({
  transactionId: "TXN-20260628001",
  msisdn: "6281234567890"
}, null, 2));

addHeading3('Success Response (200 OK)');
drawCodeBlock(JSON.stringify({
  status: "OK",
  data: {
    partnerSubscriptionId: "TXN-20260628001",
    referenceId: "e9bb49f8-d703-4903-a1bc-7bb0b21a8d05",
    msisdn: "6281234567890",
    productName: "Premium Package",
    subscriptionStatus: "active",
    createdAt: "2026-06-27T17:20:00.000Z",
    updatedAt: "2026-06-27T17:20:30.000Z"
  }
}, null, 2));

addHeading3('Error Response - Subscription Not Found (404 Not Found)');
drawCodeBlock(JSON.stringify({
  status: "Not OK",
  message: "Subscription not found"
}, null, 2));

// ----------------------------------------------------
// 7. API ENDPOINTS PART 4 & CALLBACKS (Page 7)
// ----------------------------------------------------
doc.addPage();
addHeading2('3.3. Unsubscribe API');
addParagraph('Triggers the unsubscription flow for a specific subscription. This is an asynchronous process; an initial confirmation is returned, followed by a callback to your webhook once finalized.');

doc.fontSize(10.5).font('Helvetica-Bold').fillColor(TEXT_COLOR).text(' • Method: ', { continued: true }).font('Helvetica').text('POST');
doc.fontSize(10.5).font('Helvetica-Bold').fillColor(TEXT_COLOR).text(' • URL: ', { continued: true }).font('Helvetica').text('https://<your-deployed-domain>.run.app/api/v1/subscription/unsubscribe');
doc.fontSize(10.5).font('Helvetica-Bold').fillColor(TEXT_COLOR).text(' • Auth Required: ', { continued: true }).font('Helvetica').text('Basic Authentication');
doc.moveDown(0.5);

addHeading3('Request Body Sample (JSON)');
drawCodeBlock(JSON.stringify({
  transactionId: "TXN-20260628001",
  msisdn: "6281234567890"
}, null, 2));

addHeading3('Success Response (200 OK)');
drawCodeBlock(JSON.stringify({
  status: "OK",
  message: "In Progress for unsubscription",
  data: {
    partnerSubscriptionId: "TXN-20260628001",
    referenceId: "e9bb49f8-d703-4903-a1bc-7bb0b21a8d05"
  }
}, null, 2));

// ----------------------------------------------------
// 8. CALLBACKS SECTION (Page 8)
// ----------------------------------------------------
doc.addPage();
addHeading1('4. Lifecycle Callbacks Spec');
addParagraph('LutpiPlix notifies partners of subscription lifecycle changes by sending HTTP POST requests to the Partner\'s configured Webhook URL (`CALLBACK_URL`). Partners are expected to respond with a standard `200 OK` or `204 No Content` to acknowledge successful delivery.');

addHeading2('4.1. Inactive Callback');
addParagraph('Fired automatically shortly after creation, signifying that the subscription validation stage is completed but billing is pending.');
drawCodeBlock(JSON.stringify({
  partnerSubscriptionId: "TXN-20260628001",
  referenceId: "e9bb49f8-d703-4903-a1bc-7bb0b21a8d05",
  msisdn: "6281234567890",
  productName: "Premium Package",
  subscriptionStatus: "inactive",
  timestamp: "2026-06-27T17:20:02.000Z"
}, null, 2));

addHeading2('4.2. Active Callback');
addParagraph('Fired once billing/provisioning is completed, indicating that the user\'s subscription is active.');
drawCodeBlock(JSON.stringify({
  partnerSubscriptionId: "TXN-20260628001",
  referenceId: "e9bb49f8-d703-4903-a1bc-7bb0b21a8d05",
  msisdn: "6281234567890",
  productName: "Premium Package",
  subscriptionStatus: "active",
  timestamp: "2026-06-27T17:20:32.000Z"
}, null, 2));

// ----------------------------------------------------
// 9. CALLBACKS PART 2 (Page 9)
// ----------------------------------------------------
doc.addPage();
addHeading2('4.3. Unsubscribe Callback');
addParagraph('Fired when the subscription is officially canceled and deactivated.');
drawCodeBlock(JSON.stringify({
  partnerSubscriptionId: "TXN-20260628001",
  referenceId: "e9bb49f8-d703-4903-a1bc-7bb0b21a8d05",
  msisdn: "6281234567890",
  productName: "Premium Package",
  subscriptionStatus: "unsubscribe",
  timestamp: "2026-06-27T17:21:05.000Z"
}, null, 2));

// Global Page Numbering and Header/Footer drawing
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  
  // Skip cover page
  if (i > range.start) {
    const pageNum = i - range.start + 1;
    
    // Header
    doc.fontSize(8).fillColor(SECONDARY).text('LutpiPlix Partner API Documentation', 50, 30, { align: 'left' });
    doc.moveTo(50, 42).lineTo(562, 42).strokeColor(BORDER_CODE).lineWidth(0.5).stroke();

    // Footer
    doc.moveTo(50, 750).lineTo(562, 750).strokeColor(BORDER_CODE).lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor(SECONDARY).text(`Page ${pageNum} of ${range.count}`, 50, 758, { align: 'right' });
  }
}

// End the document
doc.end();

console.log('PDF document generated successfully!');
