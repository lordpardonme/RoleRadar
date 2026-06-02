from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

OUT = Path(r"C:\Users\mohdh\Documents\Job Hunt\resumes\Mohd_Hayaat_Ali_Product_Designer_Property_Finder.pdf")

styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="Name",
        parent=styles["Title"],
        fontName="Helvetica",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#242424"),
        spaceAfter=2,
    )
)
styles.add(
    ParagraphStyle(
        name="Contact",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#4D4D4D"),
        spaceAfter=10,
    )
)
styles.add(
    ParagraphStyle(
        name="Section",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#242424"),
        spaceBefore=8,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="Role",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=colors.HexColor("#242424"),
        spaceBefore=5,
        spaceAfter=1,
    )
)
styles.add(
    ParagraphStyle(
        name="Meta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#4D4D4D"),
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        name="Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=10.5,
        textColor=colors.HexColor("#242424"),
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="ResumeBullet",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.1,
        leading=10.4,
        textColor=colors.HexColor("#242424"),
    )
)

jobs = [
    (
        "Product Designer",
        "I-DOD | New Delhi, India | 07/2025 - Present",
        [
            "Designing end-to-end mobile app experience for a relationship platform, including onboarding, KYC verification, profile creation, matching journeys, and beta feedback loops.",
            "Partnering with founders, product, and developers to turn requirements into user flows, high-fidelity Figma screens, interactive prototypes, and implementation-ready UI.",
            "Iterating through beta testing with 500+ users, incorporating usability feedback to improve onboarding clarity, profile completion, and conversion.",
        ],
    ),
    (
        "Product Designer",
        "FuelBuddy | Gurgaon, India | 07/2023 - 06/2024",
        [
            "Reworked consumer doorstep fuel delivery journey inside a 500K+ user app, reducing ordering from 8 to 3 steps and increasing completion from 62% to 78%.",
            "Designed mobile and web flows from discovery to payment, including information hierarchy, responsive UI states, error handling, and developer handoff.",
            "Created franchise web application for fleet, driver, tanker, delivery, dashboard, scheduling, and Gantt-style planning workflows across India and Dubai operations.",
            "Built Wheels driver app and B2B management flows, reducing monthly driver support tickets by 35% through clearer task, navigation, and correction UX.",
        ],
    ),
    (
        "Product Designer",
        "Uncover by Meddo | Gurgaon, India | 03/2022 - 05/2023",
        [
            "Redesigned appointment booking from 6 to 4 steps, improving completion from 71% to 83% over 8 weeks using Google Analytics tracking.",
            "Shipped doctor profile redesign that increased profile views by 28% and appointment requests by 15% in a 5,000-user A/B test.",
            "Conducted usability testing with 12 patients and 8 doctors, synthesising insights for product and engineering teams to guide iteration priorities.",
            "Contributed to Figma component library, design system documentation, and reusable UI patterns as part of a lean product team.",
        ],
    ),
    (
        "UI Designer",
        "AcadPlaza | Remote | 06/2020 - 03/2022",
        [
            "Redesigned course catalog and search experience for a learning marketplace, increasing enrollments by 18% quarter-over-quarter.",
            "Created responsive web and mobile UI components, wireframes, and style guide patterns for catalog, search, and learner journeys.",
            "Collaborated with an 8-person product, engineering, and content team in agile delivery cycles using Figma and Slack.",
        ],
    ),
]

story = [
    Paragraph("MOHD HAYAAT ALI", styles["Name"]),
    Paragraph(
        "Product Designer | mohdhayaat1@outlook.com | +91-7991880020 | Delhi, India | Dubai ready | Portfolio Link",
        styles["Contact"],
    ),
    Paragraph("PROFESSIONAL SUMMARY", styles["Section"]),
    Paragraph(
        "Product Designer with 4+ years designing shipped mobile, web, SaaS, and marketplace-style consumer experiences. Strong in Figma, UX research, usability testing, interaction design, prototyping, design systems, responsive UI, and data-informed product decisions. Open to relocate to Dubai, UAE for hybrid product design roles.",
        styles["Body"],
    ),
    Paragraph("PROFESSIONAL EXPERIENCE", styles["Section"]),
]

for title, meta, bullets in jobs:
    story.append(Paragraph(title, styles["Role"]))
    story.append(Paragraph(meta, styles["Meta"]))
    story.append(
        ListFlowable(
            [ListItem(Paragraph(item, styles["ResumeBullet"]), leftIndent=10) for item in bullets],
            bulletType="bullet",
            start="bulletchar",
            leftIndent=12,
            bulletFontSize=7,
            bulletOffsetY=1,
        )
    )
    story.append(Spacer(1, 2))

story += [
    Paragraph("SKILLS", styles["Section"]),
    Paragraph(
        "<b>Product Design:</b> End-to-end product design, mobile and web UX, marketplace search/catalog UX, interaction design, visual design, wireframing, high-fidelity UI<br/>"
        "<b>Research & Testing:</b> UX research, user interviews, usability testing, A/B testing, journey mapping, funnel analysis, Google Analytics, Hotjar<br/>"
        "<b>Design Systems:</b> Figma components, Auto Layout, component libraries, responsive UI patterns, design documentation, developer handoff<br/>"
        "<b>Prototyping & Delivery:</b> Interactive prototypes, agile collaboration, PM/research/engineering partnership, accessibility-minded UI, HTML/CSS basics<br/>"
        "<b>Tools:</b> Figma, FigJam, Miro, Adobe Creative Suite, Rive, Framer",
        styles["Body"],
    ),
    Paragraph("EDUCATION", styles["Section"]),
    Paragraph(
        "<b>BBA, Business Administration</b> | Sam Higginbottom University of Agriculture, Technology & Sciences | 2017 - 2020",
        styles["Body"],
    ),
]

doc = SimpleDocTemplate(
    str(OUT),
    pagesize=A4,
    rightMargin=0.48 * inch,
    leftMargin=0.48 * inch,
    topMargin=0.42 * inch,
    bottomMargin=0.42 * inch,
)
doc.build(story)
print(OUT)
