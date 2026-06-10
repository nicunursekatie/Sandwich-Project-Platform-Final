const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "exports", "the-sandwich-project-overview.pdf");

const COLORS = {
  navy: "#1f2d3d",
  blue: "#236383",
  teal: "#47b3cb",
  text: "#2b2b2b",
  muted: "#5d6b78",
  rule: "#d9e2e8",
};

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 64, bottom: 64, left: 64, right: 64 },
  info: {
    Title: "The Sandwich Project Platform — Overview",
    Author: "The Sandwich Project",
    Subject: "Platform description and organizational role",
  },
});

doc.pipe(fs.createWriteStream(OUT));

const PAGE_BOTTOM = doc.page.height - doc.page.margins.bottom;

function ensureSpace(needed) {
  if (doc.y + needed > PAGE_BOTTOM) doc.addPage();
}

function h1(text) {
  ensureSpace(40);
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(15).fillColor(COLORS.navy).text(text);
  const y = doc.y + 4;
  doc.moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .lineWidth(1).strokeColor(COLORS.teal).stroke();
  doc.moveDown(0.8);
}

function para(text) {
  ensureSpace(28);
  doc.font("Helvetica").fontSize(10.5).fillColor(COLORS.text)
    .text(text, { align: "left", lineGap: 2.5 });
  doc.moveDown(0.5);
}

function bulletGroup(title, items) {
  ensureSpace(34);
  if (title) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.blue).text(title);
    doc.moveDown(0.2);
  }
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  items.forEach((item) => {
    ensureSpace(20);
    const startY = doc.y;
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(COLORS.teal)
      .text("•", left + 6, startY, { continued: false });
    doc.font("Helvetica").fontSize(10.5).fillColor(COLORS.text)
      .text(item, left + 20, startY, { width: right - (left + 20), lineGap: 2 });
    doc.moveDown(0.35);
  });
  doc.moveDown(0.3);
}

// ---- Cover header ----
doc.font("Helvetica-Bold").fontSize(26).fillColor(COLORS.navy)
  .text("The Sandwich Project Platform", { align: "left" });
doc.moveDown(0.2);
doc.font("Helvetica").fontSize(13).fillColor(COLORS.blue)
  .text("Overview & Organizational Role", { align: "left" });
doc.moveDown(0.4);
const ruleY = doc.y;
doc.moveTo(doc.page.margins.left, ruleY)
  .lineTo(doc.page.width - doc.page.margins.right, ruleY)
  .lineWidth(2).strokeColor(COLORS.teal).stroke();
doc.moveDown(1);

// ---- What it is ----
h1("What It Is");
para("This is the central online system that runs the day-to-day operations of The Sandwich Project. It is the single place where volunteers, hosts, coordinators, and administrators track sandwich collections, organize events, coordinate drivers and recipients, communicate with each other, and measure the organization's impact.");
para("In short, it replaces a patchwork of spreadsheets, group texts, and manual tracking with one connected tool — letting a largely volunteer-powered organization operate with the coordination of a much larger one.");

// ---- Role ----
h1("Its Role in the Organization");
para("The platform is the operational backbone of The Sandwich Project. It keeps an accurate record of how many sandwiches are made and where they go, makes sure events are staffed and supplied, ensures recipients reliably receive food, and produces the data needed to demonstrate impact to funders and partners.");
para("It is built to protect the organization's low-overhead, volunteer-driven model by handling coordination work that would otherwise require paid staff.");

// ---- What it handles ----
h1("What It Handles");

bulletGroup("1. Sandwich Collection Tracking", [
  "Records every collection — by individual volunteers and by group events — and keeps a reliable running total.",
  "Tracks different sandwich types (e.g., deli and PB&J) with timezone-accurate dates.",
  "Acts as the official source of truth for how many sandwiches have been made, carefully avoiding double-counting.",
]);

bulletGroup("2. Event Requests & Scheduling", [
  "Captures incoming event requests (including those submitted through the organization's website) and turns them into scheduled events.",
  "Handles duplicate detection, intake validation, multi-recipient assignment, and corporate/group event follow-ups.",
  "Includes maps and AI assistants to help coordinators plan, plus auto-save and safeguards that confirm edits are saved correctly.",
]);

bulletGroup("3. Volunteer Coordination (Volunteer Hub)", [
  "A volunteer-friendly calendar showing all upcoming events, open spots, and where help is needed.",
  "Lets volunteers sign themselves up, and lets coordinators assign people and approve sign-ups.",
  "Clearly shows needs in plain language, such as \"Drivers Needed\" or \"Extra help welcome.\"",
]);

bulletGroup("4. Driver & Delivery Logistics", [
  "Tracks van-driver needs and assignments for each event.",
  "Interactive route maps and driver-optimization tools to plan efficient pickups and deliveries.",
  "A \"Nearby Recipients\" feature to connect events with recipients within range.",
]);

bulletGroup("5. Recipient & Host Management", [
  "Maintains records of recipient organizations and host locations.",
  "Maps showing hosts, events, and recipients so coordinators can see the full network geographically.",
]);

bulletGroup("6. Communication & Notifications", [
  "Built-in messaging and real-time chat, plus email and text-message notifications.",
  "Smart, tiered alerts (urgent / important / digest) and batching so people are not overwhelmed — including automated 24-hour event reminders and weekly summaries for administrators.",
  "\"Kudos\" for recognizing volunteers, and a shared inbox for linked administrator accounts.",
]);

bulletGroup("7. Impact Reporting & Analytics", [
  "Dashboards tracking collection trends, pace toward the annual goal, and operational health.",
  "Grant-reporting metrics that translate raw activity into impact (estimated participants, food value, year-over-year growth) in language suited for funders.",
  "An adjustable annual sandwich goal that can be changed without code changes.",
]);

bulletGroup("8. Administration & Governance", [
  "Role-based permissions so each person sees and does only what is appropriate for their role.",
  "Audit logs and activity tracking, document storage, organization-merge tools, customizable email templates, and guided onboarding tours.",
  "A \"Holding Zone\" for capturing and triaging long-term ideas and tasks.",
]);

// ---- Bottom line ----
h1("The Bottom Line");
para("The platform lets The Sandwich Project make more sandwiches, get them to more people, and prove its impact — all while keeping coordination overhead low. It turns a sprawling, volunteer-driven food-security effort into something organized, measurable, and scalable.");

// ---- Footer on every page ----
const range = doc.bufferedPageRange ? null : null;
doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted);
const footerY = doc.page.height - 40;
doc.text("The Sandwich Project — Reducing food waste and hunger through volunteer power.",
  doc.page.margins.left, footerY,
  { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: "center" });

doc.end();
console.log("Wrote", OUT);
