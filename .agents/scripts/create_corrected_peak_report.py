"""Create matching, evidence-based Word and PDF corrections of the supplied report.

Figures were verified with read-only production queries on 2026-09-28.
See the methodology section in the generated report for counting rules.
"""

from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)

OUT = Path("reports")
OUT.mkdir(exist_ok=True)
DOCX = OUT / "Peak_Sandwich_Collection_Weeks_Corrected.docx"
PDF = OUT / "Peak_Sandwich_Collection_Weeks_Corrected.pdf"

TITLE = "Peak Sandwich Collection Weeks"
SUBTITLE = "Corrected findings from the production collection log"
DATE_LINE = "Reviewed September 28, 2026  |  Completed weeks through September 22, 2026"
INTRO = (
    "The largest completed Wednesday-Tuesday week in the current collection records "
    "was January 15-21, 2025: 28,927 sandwiches. The supplied draft's 38,828 "
    "figure for November 2023 comes from a separate historical weekly-import table, "
    "not the current collection-log total."
)
PEAKS = [
    ("Jan 15-21, 2025", "28,927", "7,361", "21,566"),
    ("Nov 15-21, 2023", "27,810", "8,136", "19,674"),
    ("Jan 11-17, 2023", "27,132", "5,134", "21,998"),
    ("Jan 14-20, 2026", "24,717", "4,570", "20,147"),
    ("Sep 25-Oct 1, 2024", "24,664", "6,617", "18,047"),
]
YEARS = [
    ("2020*", "44,958"),
    ("2021", "281,395"),
    ("2022", "440,371"),
    ("2023", "473,409"),
    ("2024", "501,856"),
    ("2025", "526,083"),
]
FINDINGS = [
    "2025 was a complete calendar year in this dataset and logged 526,083 sandwiches, "
    "24,227 more than 2024 (+4.8%). The draft's claim of a 2025 decrease is not supported here.",
    "The largest complete month through 2025 was November 2022 (60,082). "
    "November 2023 was 54,849 in the collection log, not 65,547.",
    '"Groups" is a collection-log category, not a physical location. '
    "Group counts should not be interpreted as a single regional host's production.",
]
CORRECTIONS = [
    (
        "November 2023 record",
        "The draft calls November 15, 2023 a 38,828-sandwich record and "
        "attributes 19,414 to a special event. The current collection log totals "
        "27,810 that week (8,136 individual + 19,674 group). It includes a "
        '19,414 entry under "Groups"; the log does not establish that it was one special event.'
    ),
    (
        "Conflicting historical source",
        "The separate authoritative_weekly_collections import has 38,828 for "
        "November 15, 2023, including an additional 11,278 legacy group bucket. "
        "That bucket is not a separate entry in the current collection log. "
        "Do not add the two tables together or mix their weekly rankings."
    ),
    (
        "September 2024 week",
        "September 25-October 1, 2024 totals 24,664 in current collection records, "
        "not the draft's 24,534. It is fifth, not the all-time record, in this source."
    ),
    (
        "Events, seasonality and value",
        "The log alone cannot establish hurricane response, holiday strategy, "
        "volunteer retention, demand, organization-wide surge capacity, or dollar "
        "value. The draft's claims about these were removed instead of restated as facts."
    ),
]
METHODS = [
    "Source: production sandwich_collections table; non-deleted records with "
    "collection_date from April 22, 2020 through September 22, 2026. "
    "The ongoing September 23-29 week is excluded from peak-week rankings.",
    "Week boundaries are Wednesday through Tuesday, assigned by collection_date "
    "(when the sandwiches were collected), not the date the entry was submitted.",
    "Each record contributes individual_sandwiches plus group counts from "
    "group_collections. If the JSON group list is empty, use legacy group1_count "
    "and group2_count instead; never add both representations. String-encoded JSON "
    "group lists are parsed before summing. Soft-deleted entries are excluded.",
    "Calendar-year and monthly sums use collection_date, not the week-start date. "
    "2020 begins with the first recorded April collection; 2026 is incomplete "
    "and is not used in full-year comparisons.",
    "These are totals as recorded, not an independent audit of deliveries. "
    "Some categorization issues may still need correction by the team. "
    "The separate historical-import table gives different totals and is not "
    "silently substituted for collection records in this report.",
]

# Word version
doc = Document()
section = doc.sections[0]
section.top_margin = Inches(0.72)
section.bottom_margin = Inches(0.65)
section.left_margin = Inches(0.82)
section.right_margin = Inches(0.82)
normal = doc.styles["Normal"]
normal.font.name = "Aptos"
normal.font.size = Pt(9.5)
normal.paragraph_format.space_after = Pt(5)
for style_name, size in (("Title", 21), ("Heading 1", 13), ("Heading 2", 10.5)):
    style = doc.styles[style_name]
    style.font.name = "Aptos Display"
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = RGBColor(25, 60, 82)
    style.paragraph_format.space_before = Pt(12)
    style.paragraph_format.space_after = Pt(5)

doc.add_heading(TITLE, 0)
p = doc.add_paragraph(SUBTITLE)
p.style = "Subtitle"
doc.add_paragraph(DATE_LINE)
doc.add_heading("The corrected headline", 1)
doc.add_paragraph(INTRO)
doc.add_heading("Five highest completed weeks", 1)
tbl = doc.add_table(rows=1, cols=4)
tbl.style = "Light Shading Accent 1"
tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
for c, label in zip(tbl.rows[0].cells, ["Wednesday-Tuesday", "Total", "Individual", "Group"]):
    c.text = label
for row in PEAKS:
    for c, value in zip(tbl.add_row().cells, row):
        c.text = value
doc.add_paragraph("Group and individual are recorded categories; both are included in each total.")
doc.add_heading("Annual totals from current records", 1)
annual = doc.add_table(rows=1, cols=2)
annual.style = "Light Shading Accent 1"
annual.rows[0].cells[0].text = "Calendar year"
annual.rows[0].cells[1].text = "Sandwiches logged"
for row in YEARS:
    for c, value in zip(annual.add_row().cells, row):
        c.text = value
doc.add_paragraph("*2020 data starts April 22. 2026 is not a complete year.")
doc.add_heading("What the current data supports", 1)
for finding in FINDINGS:
    doc.add_paragraph(finding, style="List Bullet")
doc.add_page_break()
doc.add_heading("Corrections to the supplied draft", 1)
for title, body in CORRECTIONS:
    doc.add_heading(title, 2)
    doc.add_paragraph(body)
doc.add_heading("How these numbers were calculated", 1)
for item in METHODS:
    doc.add_paragraph(item, style="List Bullet")
doc.add_paragraph(
    "Data source: production database, read-only review on September 28, 2026. "
    "No collection records were edited to prepare this report."
)
footer = section.footer.paragraphs[0]
footer.text = "The Sandwich Project  |  Data-verified revision  |  September 2026"
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
doc.save(DOCX)

# PDF version with matching content and an explicit second-page fact-check.
navy = colors.HexColor("#193C52")
teal = colors.HexColor("#1A7580")
muted = colors.HexColor("#536573")
soft = colors.HexColor("#EAF3F4")
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="DocTitle", fontName="Helvetica-Bold", fontSize=19, leading=23,
    textColor=navy, spaceAfter=5, alignment=TA_LEFT
))
styles.add(ParagraphStyle(
    name="DocSubtitle", fontName="Helvetica", fontSize=10, leading=14,
    textColor=teal, spaceAfter=10
))
styles.add(ParagraphStyle(
    name="Meta", fontName="Helvetica", fontSize=8, leading=11,
    textColor=muted, spaceAfter=12
))
styles.add(ParagraphStyle(
    name="Section", fontName="Helvetica-Bold", fontSize=11, leading=15,
    textColor=navy, spaceBefore=12, spaceAfter=6
))
styles.add(ParagraphStyle(
    name="BodyCustom", fontName="Helvetica", fontSize=9, leading=13,
    textColor=navy, spaceAfter=7
))
styles.add(ParagraphStyle(
    name="SmallCustom", fontName="Helvetica", fontSize=7.7, leading=10.8,
    textColor=muted, spaceAfter=6
))
styles.add(ParagraphStyle(
    name="BoldCustom", fontName="Helvetica-Bold", fontSize=9, leading=13,
    textColor=teal, spaceAfter=3
))

def para(text, style="BodyCustom"):
    return Paragraph(text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"), styles[style])

def footer_pdf(canvas, pdf_doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D7E3E8"))
    canvas.line(0.7*inch, 0.55*inch, 7.8*inch, 0.55*inch)
    canvas.setFillColor(muted)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(0.72*inch, 0.4*inch, "The Sandwich Project | Verified from production collection records")
    canvas.drawRightString(7.78*inch, 0.4*inch, f"{pdf_doc.page}")
    canvas.restoreState()

pdf = SimpleDocTemplate(
    str(PDF), pagesize=letter, rightMargin=0.72*inch, leftMargin=0.72*inch,
    topMargin=0.63*inch, bottomMargin=0.7*inch
)
story = [
    para(TITLE, "DocTitle"), para(SUBTITLE, "DocSubtitle"),
    para(DATE_LINE, "Meta"), para("The corrected headline", "Section"),
]
callout = Table([[para(INTRO)]], colWidths=[6.95*inch])
callout.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,-1), soft),
    ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#CEE1E4")),
    ("LEFTPADDING", (0,0), (-1,-1), 12),
    ("RIGHTPADDING", (0,0), (-1,-1), 12),
    ("TOPPADDING", (0,0), (-1,-1), 11),
    ("BOTTOMPADDING", (0,0), (-1,-1), 7),
]))
story += [callout, para("Five highest completed weeks", "Section")]
peak_data = [["Wednesday-Tuesday", "Total", "Individual", "Group"]] + [list(r) for r in PEAKS]
peak_table = Table(peak_data, colWidths=[2.35*inch, 1.53*inch, 1.53*inch, 1.54*inch])
peak_table.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), navy), ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
    ("FONTNAME", (0,1), (-1,-1), "Helvetica"),
    ("FONTSIZE", (0,0), (-1,-1), 8.7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ("TOPPADDING", (0,0), (-1,-1), 7),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#F5F8FA")]),
    ("LINEBELOW", (0,-1), (-1,-1), 0.5, colors.HexColor("#CEDDE4")),
    ("ALIGN", (1,1), (-1,-1), "RIGHT"),
]))
story += [peak_table, Spacer(1, 6),
          para("Group and individual are recorded categories; both are included in each total.", "SmallCustom"),
          para("Annual totals from current records", "Section")]
annual_data = [["Year", "Logged sandwiches"]] + [list(r) for r in YEARS]
annual_table = Table(annual_data, colWidths=[1.4*inch, 2*inch])
annual_table.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), navy), ("TEXTCOLOR", (0,0), (-1,0), colors.white),
    ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
    ("FONTSIZE", (0,0), (-1,-1), 8.5), ("TOPPADDING", (0,0), (-1,-1), 4),
    ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#F5F8FA")]),
]))
story += [annual_table, para("*2020 starts April 22. 2026 is incomplete.", "SmallCustom"),
          para("What the current data supports", "Section")]
story += [para("• " + finding) for finding in FINDINGS]
story += [PageBreak(), para("Corrections to the supplied draft", "DocTitle")]
for title, body in CORRECTIONS:
    story += [KeepTogether([para(title, "BoldCustom"), para(body)])]
story += [para("How these numbers were calculated", "Section")]
story += [para("• " + item, "SmallCustom") for item in METHODS]
story += [Spacer(1, 6), para(
    "Data source: production database, read-only review on September 28, 2026. "
    "No collection records were edited to prepare this report.", "SmallCustom"
)]
pdf.build(story, onFirstPage=footer_pdf, onLaterPages=footer_pdf)
print(DOCX)
print(PDF)