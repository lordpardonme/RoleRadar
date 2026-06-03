from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

OUT = Path(r"C:\Users\mohdh\Documents\Job Hunt\resumes\Mohd_Hayaat_Ali_Product_Designer_CIG.pdf")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="ResumeName", parent=styles["Title"], fontName="Helvetica", fontSize=21, leading=25, textColor=colors.HexColor("#242424"), spaceAfter=1))
styles.add(ParagraphStyle(name="ResumeTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9.2, leading=12, textColor=colors.HexColor("#242424"), spaceAfter=2))
styles.add(ParagraphStyle(name="ResumeContact", parent=styles["Normal"], fontName="Helvetica", fontSize=8.2, leading=10.5, textColor=colors.HexColor("#4D4D4D"), spaceAfter=6))
styles.add(ParagraphStyle(name="ResumeSection", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=9.6, leading=12, textColor=colors.HexColor("#242424"), spaceBefore=7, spaceAfter=4))
styles.add(ParagraphStyle(name="ResumeRole", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10.2, leading=12.4, textColor=colors.HexColor("#242424"), spaceBefore=4, spaceAfter=1))
styles.add(ParagraphStyle(name="ResumeMeta", parent=styles["Normal"], fontName="Helvetica", fontSize=8.1, leading=10.2, textColor=colors.HexColor("#4D4D4D"), spaceAfter=3))
styles.add(ParagraphStyle(name="ResumeBody", parent=styles["Normal"], fontName="Helvetica", fontSize=8.1, leading=10.45, textColor=colors.HexColor("#242424"), spaceAfter=4))
styles.add(ParagraphStyle(name="ResumeBullet", parent=styles["Normal"], fontName="Helvetica", fontSize=7.85, leading=10.1, textColor=colors.HexColor("#242424")))

jobs = [
    ("Product Designer", "FuelBuddy | Gurgaon, India | 07/2023 - 06/2024", [
        "Designed wallet and payment-system UX improvements that reduced transaction errors by 38%, improving reliability across consumer and operational payment flows.",
        "Introduced a multi-wallet user feature that allowed a primary wallet owner to delegate access, add secondary users, and set spend limits for fleet and B2B use cases.",
        "Reworked consumer doorstep fuel delivery journey inside a 500K+ user app, reducing ordering from 8 to 3 steps and increasing completion from 62% to 78%.",
        "Designed franchise web application for fleet, driver, tanker, delivery, dashboard, scheduling, and Gantt-style planning workflows across India and Dubai operations.",
        "Built Wheels driver app and B2B management flows, reducing monthly driver support tickets by 35% through clearer task, navigation, and correction UX.",
    ]),
    ("Product Designer", "I-DOD | New Delhi, India | 07/2025 - Present", [
        "Designing end-to-end mobile app experience for a relationship platform, including onboarding, KYC verification, profile creation, matching journeys, and beta feedback loops.",
        "Partnering with founders, product, and developers to convert requirements into user flows, high-fidelity Figma screens, prototypes, and implementation-ready UI.",
        "Iterating through beta testing with 500+ users, incorporating usability feedback to improve onboarding clarity, profile completion, and conversion.",
    ]),
    ("Product Designer", "Uncover by Meddo | Gurgaon, India | 03/2022 - 05/2023", [
        "Redesigned appointment booking from 6 to 4 steps, improving completion from 71% to 83% over 8 weeks using Google Analytics tracking.",
        "Shipped doctor profile redesign that increased profile views by 28% and appointment requests by 15% in a 5,000-user A/B test.",
        "Conducted usability testing with 12 patients and 8 doctors, synthesising insights for product and engineering teams to guide iteration priorities.",
        "Contributed to Figma component library, design system documentation, and reusable UI patterns as part of a lean product team.",
    ]),
    ("UI Designer", "AcadPlaza | Remote | 06/2020 - 03/2022", [
        "Redesigned course catalog and search experience for a learning marketplace, increasing enrollments by 18% quarter-over-quarter.",
        "Created responsive web and mobile UI components, wireframes, and style guide patterns for catalog, search, and learner journeys.",
    ]),
]

story = [
    Paragraph("MOHD HAYAAT ALI", styles["ResumeName"]),
    Paragraph("Product Designer - B2B Tools & Digital Operations", styles["ResumeTitle"]),
    Paragraph('mohdhayaat1@outlook.com | +91-7991880020 | +91-7905194153 | Delhi, India | Open to relocate to Dubai, UAE | <link href="https://workofhayaat.framer.website" color="#4D4D4D">Portfolio</link>', styles["ResumeContact"]),
    HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#D9D9D9"), spaceBefore=0, spaceAfter=5),
    Paragraph("PROFESSIONAL SUMMARY", styles["ResumeSection"]),
    Paragraph("Product Designer with 4+ years designing shipped mobile, web, transactional, and operations-heavy products. Strong fit for UAE corporate-services, business setup, and digital operations teams where users need clear onboarding, verification, payments, dashboards, task flows, and service-status visibility. Recent work includes wallet/payment UX that reduced transaction errors by 38%, multi-wallet delegation with spend limits, and B2B operations dashboards across India and Dubai workflows.", styles["ResumeBody"]),
    Paragraph("PROFESSIONAL EXPERIENCE", styles["ResumeSection"]),
]

for title, meta, items in jobs:
    story.append(Paragraph(title, styles["ResumeRole"]))
    story.append(Paragraph(meta, styles["ResumeMeta"]))
    story.append(ListFlowable([ListItem(Paragraph(item, styles["ResumeBullet"]), leftIndent=10) for item in items], bulletType="bullet", start="bulletchar", leftIndent=13, bulletFontSize=7.2, bulletOffsetY=1))
    story.append(Spacer(1, 1.5))

story.extend([
    Paragraph("SKILLS", styles["ResumeSection"]),
    Paragraph("<b>B2B Operations UX:</b> Dashboards, fleet workflows, driver apps, scheduling systems, task flows, Gantt-style planning views, operational visibility, admin tools<br/><b>Corporate Service Flows:</b> Onboarding, KYC flows, verification journeys, service-status visibility, user roles, approvals, account setup, error handling<br/><b>Transactional UX:</b> Wallet flows, payment UX, transaction-error reduction, spend limits, delegated wallet access, high-trust workflows<br/><b>Product Design:</b> Mobile and web UX, interaction design, visual design, information architecture, wireframing, high-fidelity UI, responsive UI<br/><b>Research & Analytics:</b> User interviews, usability testing, A/B testing, journey mapping, funnel analysis, Google Analytics, Hotjar<br/><b>Design Systems & Delivery:</b> Figma components, Auto Layout, component libraries, design documentation, developer handoff, agile collaboration<br/><b>Tools:</b> Figma, FigJam, Miro, Adobe Creative Suite, Rive, Framer", styles["ResumeBody"]),
    Paragraph("EDUCATION", styles["ResumeSection"]),
    Paragraph("<b>BBA, Business Administration</b> | Sam Higginbottom University of Agriculture, Technology & Sciences | 2017 - 2020", styles["ResumeBody"]),
])

doc = SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=0.52 * inch, leftMargin=0.52 * inch, topMargin=0.45 * inch, bottomMargin=0.45 * inch)
doc.build(story)
print(OUT)
