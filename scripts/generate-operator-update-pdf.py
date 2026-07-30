#!/usr/bin/env python3
"""Regenerate the anonymized historical operator update PDF."""

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "operator-update-2026-07.pdf"

INK = HexColor("#171713")
CREAM = HexColor("#F6F0DF")
YELLOW = HexColor("#F3C932")
MUTED = HexColor("#5D5A50")


def paragraph(
    pdf: canvas.Canvas,
    text: str,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    size: float = 9,
    leading: float = 12,
    color=INK,
    bold: bool = False,
) -> None:
    style = ParagraphStyle(
        "body",
        fontName="Helvetica-Bold" if bold else "Helvetica",
        fontSize=size,
        leading=leading,
        textColor=color,
        alignment=TA_LEFT,
        spaceAfter=0,
    )
    block = Paragraph(text, style)
    _, rendered_height = block.wrap(width, height)
    block.drawOn(pdf, x, y - rendered_height)


def feature(
    pdf: canvas.Canvas,
    number: str,
    title: str,
    body: str,
    *,
    x: float,
    y: float,
    width: float,
) -> None:
    pdf.setFillColor(YELLOW)
    pdf.roundRect(x, y - 19, 19, 19, 4, fill=1, stroke=0)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawCentredString(x + 9.5, y - 13.2, number)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(x + 28, y - 13.5, title)
    paragraph(
        pdf,
        body,
        x=x,
        y=y - 25,
        width=width,
        height=52,
        size=8.4,
        leading=11,
        color=MUTED,
    )


def build() -> None:
    page_width, page_height = letter
    pdf = canvas.Canvas(str(OUTPUT), pagesize=letter, pageCompression=1)
    pdf.setTitle("Capture This — July 2026 Operator Update")
    pdf.setAuthor("Capture This product team")
    pdf.setSubject("Historical operator update")

    pdf.setFillColor(CREAM)
    pdf.rect(0, 0, page_width, page_height, fill=1, stroke=0)
    pdf.setFillColor(INK)
    pdf.rect(0, page_height - 118, page_width, 118, fill=1, stroke=0)
    pdf.setFillColor(YELLOW)
    pdf.rect(0, page_height - 118, 8, 118, fill=1, stroke=0)

    left = 0.55 * inch
    right = page_width - left
    pdf.setFillColor(CREAM)
    pdf.setFont("Helvetica-Bold", 19)
    pdf.drawString(left, page_height - 43, "CAPTURE THIS")
    pdf.setFillColor(YELLOW)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(left, page_height - 60, "HISTORICAL OPERATOR UPDATE")
    pdf.setFillColor(CREAM)
    pdf.setFont("Helvetica", 8)
    month = "JULY 2026"
    pdf.drawRightString(right, page_height - 46, month)

    headline_y = page_height - 151
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 23)
    pdf.drawString(left, headline_y, "The coffee app grew up this month.")
    paragraph(
        pdf,
        "It moved from a working prototype toward an operator-ready product: "
        "persistent data, simpler access, and a phone-first workflow.",
        x=left,
        y=headline_y - 15,
        width=page_width - (2 * left),
        height=34,
        size=10,
        leading=14,
        color=MUTED,
    )

    column_gap = 0.34 * inch
    column_width = (page_width - (2 * left) - column_gap) / 2
    row_one = page_height - 230
    row_two = page_height - 323
    row_three = page_height - 416

    feature(
        pdf,
        "01",
        "Your data is permanent",
        "Clients, crew, productions, and orders live in the shared database. "
        "A device failure does not erase the operating record.",
        x=left,
        y=row_one,
        width=column_width,
    )
    feature(
        pdf,
        "02",
        "Simple authenticated access",
        "Authorized operators sign in with their assigned account. Public signup "
        "is not part of the workflow.",
        x=left + column_width + column_gap,
        y=row_one,
        width=column_width,
    )
    feature(
        pdf,
        "03",
        "Everything runs from a phone",
        "Preparation, the live drink board, and label output are designed around "
        "a mobile operating loop.",
        x=left,
        y=row_two,
        width=column_width,
    )
    feature(
        pdf,
        "04",
        "Branded for Capture This",
        "The cup-label system carries the Capture This visual identity across "
        "multiple layouts.",
        x=left + column_width + column_gap,
        y=row_two,
        width=column_width,
    )
    feature(
        pdf,
        "05",
        "The live board got bolder",
        "The shoot-day board is faster to scan for a coordinator moving through "
        "a set with one hand free.",
        x=left,
        y=row_three,
        width=column_width,
    )
    feature(
        pdf,
        "06",
        "Simpler everywhere",
        "Fewer decisions and tighter flows make the product easier to hand to "
        "another authorized operator.",
        x=left + column_width + column_gap,
        y=row_three,
        width=column_width,
    )

    band_y = 1.18 * inch
    band_h = 1.25 * inch
    pdf.setFillColor(INK)
    pdf.roundRect(left, band_y, page_width - 2 * left, band_h, 8, fill=1, stroke=0)
    pdf.setFillColor(YELLOW)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(left + 16, band_y + band_h - 22, "WHAT WAS NEXT AT THE TIME")

    items = [
        ("Design polish", "Tighter type, spacing, and visual consistency."),
        ("Live sync", "Multiple authorized phones seeing current order state."),
        ("Easier handoff", "Clearer setup and operating instructions."),
    ]
    inner_width = (page_width - 2 * left - 32) / 3
    for index, (title, body) in enumerate(items):
        x = left + 16 + index * inner_width
        pdf.setFillColor(CREAM)
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(x, band_y + band_h - 42, title)
        paragraph(
            pdf,
            body,
            x=x,
            y=band_y + band_h - 48,
            width=inner_width - 12,
            height=37,
            size=7.5,
            leading=9.5,
            color=CREAM,
        )

    footer = "Historical record • Refer to docs/HANDOFF.md for current instructions"
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 7)
    pdf.drawString(left, 0.47 * inch, footer)
    page_number = "1"
    page_number_width = stringWidth(page_number, "Helvetica-Bold", 7)
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawString(right - page_number_width, 0.47 * inch, page_number)

    pdf.showPage()
    pdf.save()


if __name__ == "__main__":
    build()
