#!/usr/bin/env python3
"""
Generate a professional, high-impact, aesthetic 16:9 presentation for Bantay.
Outputs: docs/Bantay_Presentation.pptx
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# --- Color Palette ---
BG_DARK      = RGBColor(11, 22, 38)     # Deep Navy (#0B1626)
CARD_BG      = RGBColor(20, 35, 58)     # Surface Slate (#14233A)
CARD_BG_ALT  = RGBColor(16, 28, 46)     # Darker Surface (#101C2E)
CARD_BORDER  = RGBColor(40, 64, 96)     # Subtle Border (#284060)

TEXT_WHITE   = RGBColor(255, 255, 255)  # Headings (#FFFFFF)
TEXT_MUTED   = RGBColor(203, 213, 225)  # Body copy (#CBD5E1)
TEXT_DIM     = RGBColor(148, 163, 184)  # Captions / Subtitles (#94A3B8)

ACCENT_CYAN  = RGBColor(56, 189, 248)   # Primary Accent (#38BDF8)
ACCENT_GREEN = RGBColor(52, 211, 153)   # Success Accent (#34D399)
ACCENT_AMBER = RGBColor(251, 191, 36)   # Warning / Highlight (#FBBF24)
ACCENT_RED   = RGBColor(248, 113, 113)  # Alert (#F87171)

FONT_HEADING = "Helvetica Neue"
FONT_BODY    = "Segoe UI"


def create_base_slide(prs):
    """Create a blank slide with dark solid background."""
    blank_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(blank_layout)
    
    # Fill background
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid()
    bg.fill.fore_color.rgb = BG_DARK
    bg.line.fill.background()
    return slide


def add_header(slide, kicker: str, title: str, subtitle: str):
    """Standard header across content slides."""
    box = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.733), Inches(1.4))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    
    # Kicker
    p0 = tf.paragraphs[0]
    p0.text = kicker.upper()
    p0.font.name = FONT_HEADING
    p0.font.size = Pt(11)
    p0.font.bold = True
    p0.font.color.rgb = ACCENT_CYAN
    p0.space_after = Pt(4)
    
    # Title
    p1 = tf.add_paragraph()
    p1.text = title
    p1.font.name = FONT_HEADING
    p1.font.size = Pt(26)
    p1.font.bold = True
    p1.font.color.rgb = TEXT_WHITE
    p1.space_after = Pt(4)
    
    # Subtitle
    p2 = tf.add_paragraph()
    p2.text = subtitle
    p2.font.name = FONT_BODY
    p2.font.size = Pt(13)
    p2.font.color.rgb = TEXT_DIM


def add_card(slide, left, top, width, height, bg_color=CARD_BG, border_color=CARD_BORDER):
    """Add a modern rounded rectangle container."""
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    card.fill.solid()
    card.fill.fore_color.rgb = bg_color
    if border_color:
        card.line.color.rgb = border_color
        card.line.width = Pt(1)
    else:
        card.line.fill.background()
    return card


def populate_card(slide, left, top, width, height, badge: str, title: str, items: list, badge_color=ACCENT_CYAN):
    """Create a structured card with a badge, title, and bulleted takeaways."""
    add_card(slide, left, top, width, height)
    
    pad = Inches(0.28)
    tb = slide.shapes.add_textbox(left + pad, top + pad, width - (pad * 2), height - (pad * 2))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    
    # Badge / Category
    p_badge = tf.paragraphs[0]
    p_badge.text = badge.upper()
    p_badge.font.name = FONT_HEADING
    p_badge.font.size = Pt(10)
    p_badge.font.bold = True
    p_badge.font.color.rgb = badge_color
    p_badge.space_after = Pt(4)
    
    # Title
    p_title = tf.add_paragraph()
    p_title.text = title
    p_title.font.name = FONT_HEADING
    p_title.font.size = Pt(17)
    p_title.font.bold = True
    p_title.font.color.rgb = TEXT_WHITE
    p_title.space_after = Pt(12)
    
    # Bullets
    for bold_prefix, text in items:
        p_item = tf.add_paragraph()
        p_item.space_after = Pt(8)
        
        run_bullet = p_item.add_run()
        run_bullet.text = "• "
        run_bullet.font.name = FONT_BODY
        run_bullet.font.size = Pt(12)
        run_bullet.font.color.rgb = badge_color
        
        run_bold = p_item.add_run()
        run_bold.text = f"{bold_prefix} "
        run_bold.font.name = FONT_BODY
        run_bold.font.size = Pt(12)
        run_bold.font.bold = True
        run_bold.font.color.rgb = TEXT_WHITE
        
        run_text = p_item.add_run()
        run_text.text = text
        run_text.font.name = FONT_BODY
        run_text.font.size = Pt(12)
        run_text.font.color.rgb = TEXT_MUTED


def build_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    
    images_dir = os.path.abspath("docs/images")
    lockup_dark = os.path.join(images_dir, "lockup-dark.png")
    sample_rec = os.path.join(images_dir, "sample-recognition.jpg")
    app_icon = os.path.join(images_dir, "app-icon.png")

    # =========================================================================
    # SLIDE 1: Title Slide (Hero)
    # =========================================================================
    s1 = create_base_slide(prs)
    
    # Center Brand Banner
    if os.path.exists(lockup_dark):
        s1.shapes.add_picture(lockup_dark, Inches(4.4), Inches(1.3), Inches(4.533), Inches(2.06))
    
    # Title Text Frame
    tb1 = s1.shapes.add_textbox(Inches(1.5), Inches(3.6), Inches(10.333), Inches(2.8))
    tf1 = tb1.text_frame
    tf1.word_wrap = True
    
    p = tf1.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = "Real-Time Computer Laboratory Access & Attendance Intelligence"
    p.font.name = FONT_HEADING
    p.font.size = Pt(22)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE
    p.space_after = Pt(10)
    
    p_sub = tf1.add_paragraph()
    p_sub.alignment = PP_ALIGN.CENTER
    p_sub.text = "Automated RTSP Ingestion  •  InsightFace 512-d ArcFace  •  PostgreSQL pgvector Cosine Search"
    p_sub.font.name = FONT_BODY
    p_sub.font.size = Pt(13)
    p_sub.font.color.rgb = ACCENT_CYAN
    p_sub.space_after = Pt(24)
    
    p_meta = tf1.add_paragraph()
    p_meta.alignment = PP_ALIGN.CENTER
    p_meta.text = "Comprehensive Project Architecture & Technical Defense"
    p_meta.font.name = FONT_BODY
    p_meta.font.size = Pt(12)
    p_meta.font.color.rgb = TEXT_DIM

    # =========================================================================
    # SLIDE 2: The Problem Space (3 Impact Cards)
    # =========================================================================
    s2 = create_base_slide(prs)
    add_header(s2, "Operational Challenges", "Why Traditional Lab Logging Fails",
               "Physical sign-in logbooks create unacceptable friction, audit loopholes, and security blindspots.")
    
    c_w = Inches(3.68)
    c_h = Inches(4.65)
    c_top = Inches(2.15)
    
    populate_card(s2, Inches(0.8), c_top, c_w, c_h,
                  badge="Bottlenecks",
                  title="Severe Entry Friction",
                  items=[
                      ("Doorway Congestion:", "15–30 seconds spent per student writing handwritten records."),
                      ("Class Schedule Delays:", "Queues spill outside the lab during peak 5-minute room turnovers."),
                      ("Lost Instruction Time:", "Instructors lose 10+ minutes waiting for manual attendance completion.")
                  ], badge_color=ACCENT_RED)
    
    populate_card(s2, Inches(4.83), c_top, c_w, c_h,
                  badge="Data Integrity",
                  title="Zero Identity Verification",
                  items=[
                      ("Proxy Attendance:", "Easy buddy-signing and forged attendance without verification."),
                      ("Illegible Handwriting:", "Signatures and ID numbers cannot be reliably parsed or audited."),
                      ("Intrusion Vulnerability:", "Unregistered or banned individuals pass through unnoticed.")
                  ], badge_color=ACCENT_AMBER)
    
    populate_card(s2, Inches(8.85), c_top, c_w, c_h,
                  badge="Visibility",
                  title="Zero Real-Time Oversight",
                  items=[
                      ("Blind Occupancy:", "No live headcount or capacity monitoring across computer labs."),
                      ("Manual Auditing:", "Historical roll calls require tedious manual paper transcription."),
                      ("Emergency Risk:", "Impossible to produce accurate occupancy lists during campus evacuations.")
                  ], badge_color=ACCENT_CYAN)

    # =========================================================================
    # SLIDE 3: The Solution (Core Pillars)
    # =========================================================================
    s3 = create_base_slide(prs)
    add_header(s3, "The Solution", "Touchless, Automated Campus Lab Intelligence",
               "Bantay turns standard IP and phone camera streams into an instant, tamper-proof access monitoring system.")
    
    populate_card(s3, Inches(0.8), c_top, c_w, c_h,
                  badge="Autonomous",
                  title="Frictionless Ingestion",
                  items=[
                      ("Any Camera Feed:", "Connects to IP cameras, RTSP CCTVs, or budget phone cameras (IP Webcam)."),
                      ("Decoupled Threading:", "Dedicated frame grabbers discard stale buffers to eliminate streaming lag."),
                      ("Zero Physical Touch:", "Walk-through recognition without student interaction or slowing down.")
                  ], badge_color=ACCENT_GREEN)
    
    populate_card(s3, Inches(4.83), c_top, c_w, c_h,
                  badge="Speed & Precision",
                  title="Sub-Millisecond Match",
                  items=[
                      ("512-d Feature Vectors:", "InsightFace ArcFace deep embeddings robust to lighting and rotation."),
                      ("PostgreSQL pgvector:", "HNSW cosine distance indexing matches registered identities in < 50ms."),
                      ("Unified Database:", "Zero sync lag between biometric embeddings and student access logs.")
                  ], badge_color=ACCENT_CYAN)
    
    populate_card(s3, Inches(8.85), c_top, c_w, c_h,
                  badge="Reliability",
                  title="Production Safeguards",
                  items=[
                      ("Strict Thresholding:", "Matches below confidence score are safely classified as Unknown."),
                      ("Anti-Spam Cooldown:", "Suppresses duplicate entry writes when attendees loiter at the doorway."),
                      ("Privacy by Design:", "Live frames processed ephemerally in RAM; no persistent video storage.")
                  ], badge_color=ACCENT_AMBER)

    # =========================================================================
    # SLIDE 4: Architecture Pipeline (5-Step Horizontal Flow)
    # =========================================================================
    s4 = create_base_slide(prs)
    add_header(s4, "Engineering Pipeline", "From Video Frame to Verified Entry Log",
               "A decoupled, asynchronous processing pipeline engineered for high throughput and continuous uptime.")
    
    step_w = Inches(2.18)
    step_h = Inches(4.65)
    step_gap = Inches(0.2)
    step_lefts = [Inches(0.8) + i * (step_w + step_gap) for i in range(5)]
    
    steps = [
        ("Step 01", "Capture", ACCENT_CYAN, [
            ("RTSP Ingestion:", "Async OpenCV worker daemon."),
            ("Stale Drop:", "Expires delayed frames to preserve real-time sync."),
            ("Source Agnostic:", "CCTV or Phone streams.")
        ]),
        ("Step 02", "Inference", ACCENT_GREEN, [
            ("InsightFace:", "Buffalo_L SCRFD face detector."),
            ("5-Point Landmark:", "Affine alignment transforms."),
            ("Embedding:", "512-d normalized ArcFace vector.")
        ]),
        ("Step 03", "Vector Search", ACCENT_CYAN, [
            ("pgvector Index:", "HNSW cosine distance ($<=>$)."),
            ("Speed:", "Sub-millisecond candidate lookup."),
            ("Hybrid Schema:", "Biometric vector stored beside student data.")
        ]),
        ("Step 04", "Verification", ACCENT_AMBER, [
            ("Threshold Guard:", "Cutoff >= 0.35 similarity."),
            ("Unknown Tag:", "Unmatched faces masked safely."),
            ("Anti-Spam:", "Enforces 120s cooldown delay.")
        ]),
        ("Step 05", "Broadcast", ACCENT_GREEN, [
            ("Relational Log:", "Writes timestamped entry row."),
            ("MJPEG Stream:", "Renders bounding boxes & % badges."),
            ("Web Dashboard:", "Updates live occupancy metrics.")
        ]),
    ]
    
    for i, (badge, title, col, items) in enumerate(steps):
        populate_card(s4, step_lefts[i], c_top, step_w, step_h,
                      badge=badge, title=title, items=items, badge_color=col)

    # =========================================================================
    # SLIDE 5: Recognition Engine & Vector Search
    # =========================================================================
    s5 = create_base_slide(prs)
    add_header(s5, "Deep Dive", "High-Dimensional Vector Similarity Matching",
               "Eliminating dedicated vector cluster overhead by pairing InsightFace with PostgreSQL pgvector.")
    
    # 3 Stat Metric Callouts at Top
    stat_w = Inches(3.68)
    stat_h = Inches(1.3)
    stat_top = Inches(2.1)
    
    stats = [
        ("512", "DIMENSIONS", "Dense ArcFace feature vector representation", ACCENT_CYAN),
        ("< 50ms", "MATCH LATENCY", "HNSW cosine distance index evaluation", ACCENT_GREEN),
        ("0.35", "SIMILARITY CUTOFF", "Calibrated confidence barrier for authorization", ACCENT_AMBER),
    ]
    
    for i, (big, label, sub, col) in enumerate(stats):
        s_left = Inches(0.8) + i * (stat_w + Inches(0.35))
        add_card(s5, s_left, stat_top, stat_w, stat_h, bg_color=CARD_BG_ALT)
        tb_stat = s5.shapes.add_textbox(s_left + Inches(0.2), stat_top + Inches(0.15), stat_w - Inches(0.4), stat_h - Inches(0.3))
        tf_s = tb_stat.text_frame
        tf_s.word_wrap = True
        
        p_big = tf_s.paragraphs[0]
        p_big.text = big
        p_big.font.name = FONT_HEADING
        p_big.font.size = Pt(28)
        p_big.font.bold = True
        p_big.font.color.rgb = col
        
        p_sub = tf_s.add_paragraph()
        p_sub.text = f"{label} • {sub}"
        p_sub.font.name = FONT_BODY
        p_sub.font.size = Pt(10)
        p_sub.font.color.rgb = TEXT_DIM
    
    # 2 Detailed Cards below
    col_w = Inches(5.69)
    col_h = Inches(3.2)
    col_top = Inches(3.6)
    
    populate_card(s5, Inches(0.8), col_top, col_w, col_h,
                  badge="Vision Engine",
                  title="InsightFace ArcFace (Buffalo_L)",
                  items=[
                      ("Additive Angular Margin Loss:", "Enforces geodesic separation on the hypersphere."),
                      ("High Environmental Tolerance:", "Invariant to indoor illumination swings, eyeglasses, and head yaw."),
                      ("Ephemeral In-Memory Inference:", "Decoded frames remain strictly in RAM; never serialized to disk.")
                  ], badge_color=ACCENT_CYAN)
    
    populate_card(s5, Inches(6.84), col_top, col_w, col_h,
                  badge="Relational Vectors",
                  title="PostgreSQL + pgvector Extension",
                  items=[
                      ("Unified Architecture:", "Biometrics and relational tables (persons, entries, cameras) live in one database."),
                      ("HNSW Fast Search:", "Hierarchical Navigable Small World graphs deliver sub-millisecond nearest neighbors."),
                      ("ACID Guarantees:", "Attendance transactions, cooldown locks, and vector matching execute atomically.")
                  ], badge_color=ACCENT_GREEN)

    # =========================================================================
    # SLIDE 6: Production Safeguards & Privacy
    # =========================================================================
    s6 = create_base_slide(prs)
    add_header(s6, "Production Hardening", "Engineered for Reliability, Privacy & Trust",
               "Preventing misattributions, duplicate logs, and surveillance concerns in real university environments.")
    
    populate_card(s6, Inches(0.8), c_top, c_w, c_h,
                  badge="Privacy Barrier",
                  title="Strict 'Unknown' Tagging",
                  items=[
                      ("Sub-Threshold Shield:", "Any face match below threshold is explicitly designated as Unknown."),
                      ("Zero Identity Leaks:", "Candidate names and profile IDs are completely hidden when confidence is low."),
                      ("Visual Feedback:", "Distinct white box and dark badge clarify unverified visitor status.")
                  ], badge_color=ACCENT_AMBER)
    
    populate_card(s6, Inches(4.83), c_top, c_w, c_h,
                  badge="Anti-Spam Engine",
                  title="Configurable Cooldown",
                  items=[
                      ("Loitering Protection:", "Configurable cooldown (e.g. 120s) suppresses spam when students pause at doors."),
                      ("Per-Person Clock:", "Tracks recent entry timestamps in-memory and in relational database records."),
                      ("Audit Accuracy:", "Logs one precise record per transit rather than hundreds of false duplicate hits.")
                  ], badge_color=ACCENT_CYAN)
    
    populate_card(s6, Inches(8.85), c_top, c_w, c_h,
                  badge="Data Protection",
                  title="Ephemeral Video Stream",
                  items=[
                      ("No Video Hoarding:", "RTSP frames are processed on-the-fly and immediately garbage-collected."),
                      ("Compact Vectors:", "Only 512-float vector embeddings are stored, not identifiable surveillance video."),
                      ("Campus Policy Compliance:", "Meets strict institutional student data privacy mandates.")
                  ], badge_color=ACCENT_GREEN)

    # =========================================================================
    # SLIDE 7: Live Demonstration (Visual Screenshot Showcase)
    # =========================================================================
    s7 = create_base_slide(prs)
    add_header(s7, "System Verification", "Real-Time Multi-Face Recognition in Action",
               "Live test recognition showing simultaneous tracking, identity matching, and safe Unknown fallback.")
    
    # Left: Embed sample-recognition.jpg
    img_left = Inches(0.8)
    img_top = Inches(2.15)
    img_w = Inches(6.8)
    img_h = Inches(4.65)
    
    if os.path.exists(sample_rec):
        add_card(s7, img_left - Inches(0.05), img_top - Inches(0.05), img_w + Inches(0.1), img_h + Inches(0.1),
                 bg_color=CARD_BG_ALT, border_color=ACCENT_CYAN)
        s7.shapes.add_picture(sample_rec, img_left, img_top, img_w, img_h)
    
    # Right: Callout Highlights
    side_left = Inches(7.85)
    side_w = Inches(4.68)
    populate_card(s7, side_left, img_top, side_w, img_h,
                  badge="Live Capabilities",
                  title="Visual Proof Points",
                  items=[
                      ("Dual-Face Tracking:", "Simultaneously isolates multiple faces across wide lens angles."),
                      ("Confidence Scoring:", "Evaluates cosine similarity percentage against enrolled profiles."),
                      ("Sub-Threshold Unknown:", "Demonstrates safe fallback when subject does not meet authorization score."),
                      ("Admin Workbench:", "Enables operators to test images, tune threshold sliders, and verify accuracy.")
                  ], badge_color=ACCENT_GREEN)

    # =========================================================================
    # SLIDE 8: Administrator Dashboard
    # =========================================================================
    s8 = create_base_slide(prs)
    add_header(s8, "User Experience", "Comprehensive Lab Management Dashboard",
               "Intuitive React 19 interface providing real-time oversight and administrative control.")
    
    d_w = Inches(5.69)
    d_h = Inches(2.2)
    d_top1 = Inches(2.15)
    d_top2 = Inches(4.6)
    
    populate_card(s8, Inches(0.8), d_top1, d_w, d_h,
                  badge="Live Streams",
                  title="Multi-Camera Live View",
                  items=[
                      ("MJPEG Streams:", "Low-latency live visual feeds with rendered bounding boxes."),
                      ("Health Monitoring:", "Real-time camera worker status (Online / Offline / Error).")
                  ], badge_color=ACCENT_CYAN)
    
    populate_card(s8, Inches(6.84), d_top1, d_w, d_h,
                  badge="Attendance Logs",
                  title="Searchable Entry Logbook",
                  items=[
                      ("Filterable Records:", "Filter by laboratory, role (Student/Faculty), camera, or date."),
                      ("Direction Tracking:", "Clear distinction between ENTRY and EXIT events.")
                  ], badge_color=ACCENT_GREEN)
    
    populate_card(s8, Inches(0.8), d_top2, d_w, d_h,
                  badge="Analytics",
                  title="Occupancy & Traffic Trends",
                  items=[
                      ("Live Headcount:", "Real-time room occupancy gauges against lab seat capacity."),
                      ("Peak Hour Heatmaps:", "Hourly traffic trends to optimize lab class scheduling.")
                  ], badge_color=ACCENT_AMBER)
    
    populate_card(s8, Inches(6.84), d_top2, d_w, d_h,
                  badge="Enrollment",
                  title="1-Click Person Registration",
                  items=[
                      ("Drag-and-Drop Photo:", "Instant face extraction and 512-d ArcFace vector generation."),
                      ("Immediate Activation:", "Enrolled students are instantly recognized on all lab cameras.")
                  ], badge_color=ACCENT_CYAN)

    # =========================================================================
    # SLIDE 9: Technology Stack
    # =========================================================================
    s9 = create_base_slide(prs)
    add_header(s9, "Engineering Stack", "Modern, Production-Grade Architecture",
               "Built on high-performance open source technologies with zero proprietary lock-in.")
    
    ts_w = Inches(2.72)
    ts_h = Inches(4.65)
    ts_lefts = [Inches(0.8) + i * Inches(3.0) for i in range(4)]
    
    tech_cards = [
        ("Frontend", "Client Web App", ACCENT_CYAN, [
            ("React 19:", "Next-gen concurrent rendering."),
            ("TypeScript:", "Strict type safety across API boundaries."),
            ("Tailwind CSS v4:", "High-performance modern styles."),
            ("Recharts:", "Dynamic occupancy visualizations.")
        ]),
        ("Backend", "High-Speed API", ACCENT_GREEN, [
            ("FastAPI:", "Asynchronous Python 3.12 endpoints."),
            ("Pydantic v2:", "High-speed schema validation."),
            ("Uvicorn ASGI:", "Production concurrent server."),
            ("Async Workers:", "Decoupled RTSP grabber threads.")
        ]),
        ("Vision & AI", "Inference Layer", ACCENT_AMBER, [
            ("InsightFace:", "State-of-the-art Buffalo_L model."),
            ("ONNX Runtime:", "Hardware-accelerated execution."),
            ("OpenCV:", "Low-level RTSP frame capture."),
            ("Scikit-Image:", "Landmark affine transformations.")
        ]),
        ("Data & Infra", "Persistence & Ops", ACCENT_CYAN, [
            ("PostgreSQL 16:", "Industrial-strength relational core."),
            ("pgvector:", "High-dimensional HNSW cosine search."),
            ("SQLAlchemy 2.0:", "Modern declarative ORM & Alembic."),
            ("Docker Compose:", "One-command deployment container.")
        ]),
    ]
    
    for i, (badge, title, col, items) in enumerate(tech_cards):
        populate_card(s9, ts_lefts[i], c_top, ts_w, ts_h,
                      badge=badge, title=title, items=items, badge_color=col)

    # =========================================================================
    # SLIDE 10: Impact, Roadmap & Conclusion
    # =========================================================================
    s10 = create_base_slide(prs)
    add_header(s10, "Summary & Vision", "Immediate Impact & Future Roadmap",
               "Delivering measurable administrative efficiency today while laying the ground for campus-wide smart access.")
    
    pop_w = Inches(5.69)
    pop_h = Inches(4.65)
    
    populate_card(s10, Inches(0.8), c_top, pop_w, pop_h,
                  badge="Current Value",
                  title="Measurable Operational Impact",
                  items=[
                      ("100% Touchless:", "Completely eliminates manual line bottlenecks during class turnovers."),
                      ("Tamper-Proof Audit:", "ArcFace vector verification prevents proxy attendance and buddy-signing."),
                      ("Cost Effective:", "Reuses standard network CCTVs and low-cost smartphones; zero bespoke sensors."),
                      ("Instant Roll Calls:", "Immediate real-time occupancy counts available during fire and safety drills."),
                      ("Paperless Campus:", "Eliminates physical logbooks and administrative data entry overhead.")
                  ], badge_color=ACCENT_GREEN)
    
    populate_card(s10, Inches(6.84), c_top, pop_w, pop_h,
                  badge="Next Milestones",
                  title="Future Strategic Roadmap",
                  items=[
                      ("Active Liveness Detection:", "Infrared / 3D depth anti-spoofing against screen presentation attacks."),
                      ("Automated Intrusion Alerts:", "Push notifications to campus security for unauthorized after-hours entry."),
                      ("Multi-Factor Hybrid Access:", "Optional RFID / Student Card pairing for high-security research labs."),
                      ("Multi-Camera Triangulation:", "Synchronized tracking across entry and exit portals for seamless transit.")
                  ], badge_color=ACCENT_CYAN)
    
    # Save Presentation
    output_path = os.path.abspath("docs/Bantay_Presentation.pptx")
    prs.save(output_path)
    print(f"Presentation successfully generated at: {output_path}")


if __name__ == "__main__":
    build_deck()
