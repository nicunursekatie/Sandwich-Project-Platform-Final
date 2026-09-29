from pathlib import Path
import fitz

source = Path("attached_assets/Key_Findings__Peak_Sandwich_Collection_Weeks_1790639665717.pdf")
output = Path(".agents/outputs/peak_report_original_page_1.png")
output.parent.mkdir(parents=True, exist_ok=True)
document = fitz.open(source)
print(f"Pages: {len(document)}, page 1 size: {document[0].rect}")
document[0].get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(output)
print(output)

corrected = fitz.open("reports/Peak_Sandwich_Collection_Weeks_Corrected.pdf")
for index, page in enumerate(corrected):
    path = output.parent / f"peak_report_corrected_page_{index + 1}.png"
    page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(path)
    print(path)

full = fitz.open("reports/Peak_Sandwich_Collection_Weeks_Full_Corrected.pdf")
for index, page in enumerate(full):
    path = output.parent / f"peak_report_full_page_{index + 1}.png"
    page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False).save(path)
    print(path)