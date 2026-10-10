# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

UniFlow is primarily for university students, initially students at the National Institute of Technology Hamirpur (NIT Hamirpur). This includes first-year students who are unfamiliar with campus resources and students who need a faster way to keep up with notices, deadlines, opportunities, and events.

Secondary users are authorized club organizers and campus administrators who publish announcements and events for relevant students.

## Product Purpose

UniFlow is an AI-powered campus information and engagement platform that brings fragmented campus information into one personalized, easy-to-use hub. It helps students discover what matters, verify the original source, and take action without navigating WhatsApp groups, Instagram, college websites, notice boards, PDFs, and academic portals separately.

The focused hackathon MVP centers on a personalized “Today & Soon” feed for campus notices, events, scholarships, and deadlines; source verification for every item; and AI-assisted publishing that turns an uploaded notice or event poster into structured information for human review before publication.

## Positioning

UniFlow is an independent, student-focused campus information hub rather than an official NIT Hamirpur product or an oversized campus super-app. Its defining mechanism is the trusted publishing loop: campus notice or poster → AI extraction → human verification → publication → personalized student feed.

## Operating Context

Students currently encounter important information across disconnected channels and often need to assess whether an item is current and trustworthy. UniFlow supports a workflow of discovering a relevant item, checking publisher and original-source details, reviewing dates and verification metadata, and taking the next action.

Authorized publishers upload source material such as notices or event posters. AI extracts structured fields, schema validation checks the result, and a human reviews and approves the item before it reaches students.

## Capabilities and Constraints

- Core student workflows are a personalized “Today & Soon” feed, source verification, and actionable discovery of events, clubs, deadlines, scholarships, academic resources, and campus facilities.
- Core publishing workflow is AI-assisted extraction from a notice or poster, human review, and approved publication.
- Preserve original source links, publisher identity, document dates, publication timestamps, and verification metadata.
- Missing fields remain empty or null. Ambiguous dates are flagged for human review. AI-generated information is not published without schema validation and human approval.
- UniFlow is independent and must not imply NIT Hamirpur endorsement or invent institutional partnerships.
- Do not claim unsupported attendance integration, results access, restricted academic resources, institutional APIs, or other capabilities outside the focused MVP.
- The implementation is expected to use React, TypeScript, Vite, Tailwind CSS, Motion, Supabase, and Gemma 4 through the Gemini API where applicable. API keys and confidential credentials must never be exposed in frontend code.
- Prioritize a focused, functional, trustworthy MVP over unnecessary feature expansion, while keeping the architecture maintainable and extensible beyond NIT Hamirpur.

## Brand Commitments

Preserve the UniFlow name, existing logo, approved branding, authentic project assets, and established modern, premium, minimal, student-friendly design direction. Preserve working layouts, components, routes, and interactions unless an improvement is justified.

The public landing page may be expressive, while authenticated student experiences should prioritize clarity, efficient information discovery, source transparency, and readability. The product should feel like a modern campus operating system rather than a traditional college website.

## Evidence on Hand

The project contains an existing landing-page prototype, logo and image assets, and an interactive “Today & Soon” campus inbox preview. Current preview content is illustrative and must remain clearly distinguished from verified campus information. No institutional endorsement, product metrics, testimonials, partnerships, or other unsupported proof may be fabricated.

## Product Principles

- Discover what matters → verify the source → take action.
- Make important campus information accessible, trustworthy, and actionable.
- Keep the MVP focused on real student value instead of expanding into an oversized super-app.
- Preserve source transparency and human accountability around AI-assisted publishing.
- Build accessible, maintainable foundations that can expand beyond one campus without premature enterprise complexity.

## Accessibility & Inclusion

Follow WCAG 2.2 AA principles wherever applicable. Provide readable typography, sufficient contrast, semantic HTML, keyboard navigation, visible focus states, descriptive labels, and reduced-motion support. Responsive layouts must work across mobile, tablet, and desktop, with deadlines, source links, and primary actions remaining accessible on small screens. Important interfaces should account for loading, empty, error, and success states.
