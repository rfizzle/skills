# Sources

The public sources this skill derives from, and what it takes from each.
Cite these when asked where a rule comes from. Check the current edition
before quoting a revision number to an auditor; standards are revised.

## First principles

- **Saltzer, J. H. and Schroeder, M. D., "The Protection of Information in
  Computer Systems", Proceedings of the IEEE 63(9), September 1975,
  pp. 1278-1308.** The eight design principles (P1 to P8) and the two
  further ones (work factor, compromise recording). The root of the
  principle set.
- **Anderson, J. P., "Computer Security Technology Planning Study",
  ESD-TR-73-51, US Air Force Electronic Systems Division, October 1972.**
  The reference monitor: an enforcement mechanism that is always invoked,
  tamper-proof and small enough to be verified. Used in the trust model.
- **Kerckhoffs, A., "La cryptographie militaire", Journal des sciences
  militaires, 1883.** A system should stay secure when everything but the
  key is public. The origin of P4.
- **Confidentiality, integrity, availability.** No single origin; the
  three properties appear together in early computer security literature
  and are defined in US law (44 U.S.C. 3552) and FIPS 199. Used as the
  properties in classification and risk statements.

## NIST publications (public domain in the United States)

- **SP 800-160 Volume 1 Revision 1, "Engineering Trustworthy Secure
  Systems" (2022).** Security as a systems engineering discipline; a longer
  catalogue of design principles. Background; consult it when a principle
  needs more depth than the eleven here give.
- **SP 800-53 Revision 5, "Security and Privacy Controls for Information
  Systems and Organizations".** A control catalogue. One candidate baseline.
- **Cybersecurity Framework (CSF) 2.0 (2024).** Six functions: Govern,
  Identify, Protect, Detect, Respond, Recover. One candidate baseline and a
  common reporting structure.
- **SP 800-207, "Zero Trust Architecture" (2020).** Policy decision and
  enforcement points; no implicit trust from network location. Used in the
  trust model.
- **SP 800-30 Revision 1, "Guide for Conducting Risk Assessments".** Threat,
  vulnerability, likelihood, impact. Used for risk statements.
- **SP 800-39, "Managing Information Security Risk".** Organisation-level
  risk framing, including risk tolerance.
- **NISTIR 8286, "Integrating Cybersecurity and Enterprise Risk
  Management" (2020).** The distinction between risk appetite (set at the
  top) and risk tolerance (the measurable limit beneath it). Used for risk
  appetite.
- **FIPS 199, "Standards for Security Categorization of Federal
  Information and Information Systems".** Low, moderate and high impact
  against confidentiality, integrity and availability. Used for data
  classification.

## Threat modelling

- **Kohnfelder, L. and Garg, P., "The threats to our products", Microsoft,
  1999.** The STRIDE categories: spoofing, tampering, repudiation,
  information disclosure, denial of service, elevation of privilege.
- **Shostack, A., "Threat Modeling: Designing for Security", Wiley, 2014.**
  The four-question frame and STRIDE applied to data-flow diagrams.
- **Threat Modeling Manifesto (2020), threatmodelingmanifesto.org.** Values
  and principles for the practice, and the wording of the four questions
  used here: what are we working on, what can go wrong, what are we going
  to do about it, did we do a good enough job.

## Frameworks named but not reproduced

These are copyrighted or proprietary. Name them, point to clause or section
numbers, and do not copy their text or structure.

- **ISO/IEC 27001 and 27002.** Management system requirements and a control
  set. One candidate baseline, and the usual one where certification is
  wanted.
- **CIS Critical Security Controls.** A prioritised control list with
  implementation groups. One candidate baseline for smaller organisations.
- **SABSA.** A business-driven security architecture framework built on
  traceability from business requirement to control. The traceability rule
  in this skill is the same idea, reached independently from the principle
  set; an organisation that uses SABSA should use its own artefacts.
- **TOGAF.** An enterprise architecture method. Where it is in use,
  security architecture documents follow its governance, not a parallel
  one.

## Practice

- **Nygard, M., "Documenting Architecture Decisions" (2011).** The
  architecture decision record: context, decision, status, consequences.
  The decision record template follows this shape.
- **Defense in depth.** A military concept applied to information systems
  by the US National Security Agency in its Information Assurance Technical
  Framework papers (around 2000). The origin of P10.
- **Assume breach.** An industry practice with no single source; SP 800-207
  states the equivalent assumption that the network is always hostile. The
  origin of P11.
