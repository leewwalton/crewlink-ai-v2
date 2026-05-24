"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requests } from "@crewlink/domain";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import { createContact, subscribeNewsletter } from "../utils/api-client";
import { CREWLINK_AI_LEGAL_NAME } from "../utils/legal";
import "./LandingPage.css";

type Persona = "operator" | "pilot";

type WorkflowStep = {
  title: string;
  body: string;
};

type PersonaContent = {
  label: string;
  pills: string[];
  eyebrow: string;
  headline: string;
  subhead: string;
  primaryCta: string;
  primaryRoute: string;
  secondaryCta: string;
  fineprint: string;
  workflowTitle: string;
  workflowIntro: string;
  workflowSteps: WorkflowStep[];
  featuresTitle: string;
  featuresIntro: string;
  capabilities: [string, string][];
  networkCenter: string;
  networkPins: [string, string, string];
  networkStats: [string, string][];
};

const personaContent: Record<Persona, PersonaContent> = {
  operator: {
    label: "Operator",
    pills: ["Flight departments", "Charter operators", "Live staffing"],
    eyebrow: "Operator workflow · live staffing",
    headline: "Find qualified flight crew before the trip goes sideways.",
    subhead:
      "CrewLinkAI helps flight departments discover pilots by aircraft type, availability, verification status, and proximity, then explains why each match is operationally ready.",
    primaryCta: "Open operator cockpit",
    primaryRoute: "/dashboard",
    secondaryCta: "See operator workflow",
    fineprint: `${CREWLINK_AI_LEGAL_NAME} supports staffing decisions. Operators remain responsible for credential review, compliance, and hiring decisions.`,
    workflowTitle: "From request to shortlist in minutes.",
    workflowIntro:
      "Convert mission requirements into a qualified candidate stack using deterministic scoring and optional AI-generated explanations.",
    workflowSteps: [
      {
        title: "Define trip",
        body: "Aircraft, route, dates, crew role, minimum hours, and required documents.",
      },
      {
        title: "Search live network",
        body: "Filter by rating, location, availability, experience, and contract preference.",
      },
      {
        title: "Review matches",
        body: "See score factors, distance, missing requirements, and verification status.",
      },
      {
        title: "Contact crew",
        body: "Message pilots, shortlist candidates, and move requests into reviewing or filled status.",
      },
    ],
    featuresTitle: "Built for aircraft operators.",
    featuresIntro: "Focus on readiness signals that matter when staffing changes fast.",
    capabilities: [
      ["Pilot discovery", "Search qualified pilots by aircraft, rating, medical, documents, and region."],
      ["Live network map", "See proximity to the departure airport, standby clusters, and open trip demand."],
      ["Explainable matching", "Rank candidates with availability, qualification, distance, and experience signals."],
      ["Instant Pilot Mode", "Launch urgent staffing requests and shortlist crews from one cockpit."],
    ],
    networkCenter: "KTEB",
    networkPins: ["G650 PIC", "CL350 SIC", "PC-24 PIC"],
    networkStats: [
      [`${requests.length}`, "open urgent requests"],
      ["100%", "top match readiness"],
      ["0 NM", "closest qualified pilot"],
    ],
  },
  pilot: {
    label: "Pilot",
    pills: ["Contract pilots", "Type-rated crew", "Live availability"],
    eyebrow: "Pilot workflow · contract coverage",
    headline: "Get in front of the trips that fit your qualifications.",
    subhead:
      "CrewLinkAI keeps your profile, availability, and location visible to operators searching for qualified crew, then surfaces scored trip matches you can review and respond to directly.",
    primaryCta: "View pilot matches",
    primaryRoute: "/matches",
    secondaryCta: "See pilot workflow",
    fineprint:
      "Pilots control what they share on the network. Operators remain responsible for final hiring, compliance, and credential verification.",
    workflowTitle: "From profile to booked trip.",
    workflowIntro:
      "Stay discoverable when you are available, review scored opportunities, and move quickly when the right coverage request appears.",
    workflowSteps: [
      {
        title: "Build profile",
        body: "Publish aircraft experience, type ratings, certificates, documents, and contract preferences.",
      },
      {
        title: "Set availability",
        body: "Mark available, standby, or limited windows so operators only see you when you can actually fly.",
      },
      {
        title: "Review matches",
        body: "See scored trip requests with distance, qualification fit, and missing requirements called out clearly.",
      },
      {
        title: "Message operators",
        body: "Reply to staffing outreach, discuss trip details, and move promising coverage into contract review.",
      },
    ],
    featuresTitle: "Built for contract pilots.",
    featuresIntro: "Make your readiness visible without giving up control of how you work.",
    capabilities: [
      ["Live profile", "Keep ratings, medical status, documents, and home base current in one place."],
      ["Scored trip feed", "Review open requests ranked by aircraft fit, availability overlap, and proximity."],
      ["Direct messaging", "Chat with operators about trip details without leaving the platform."],
      ["Network visibility", "See where demand is clustering and when your standby window puts you closest."],
    ],
    networkCenter: "YOU",
    networkPins: ["G650 PIC · 94%", "TEB rotation", "Reply pending"],
    networkStats: [
      ["3", "new trip matches"],
      ["94%", "top match score"],
      ["112 NM", "to next departure"],
    ],
  },
};

export default function LandingPage() {
  const router = useRouter();
  const [persona, setPersona] = useState<Persona>("operator");
  const content = personaContent[persona];
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    message: "",
  });
  const [status, setStatus] = useState("");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterStatus, setNewsletterStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  return (
    <div className="landing-page">
      <header className="topbar">
        <div className="container">
          <nav aria-label="Primary navigation">
            <Logo />
            <div className="menu">
              <a href="#workflow">Workflow</a>
              <a href="#features">Features</a>
              <a href="#newsletter">Newsletter</a>
              <a href="#contact">Demo</a>
              <ThemeToggle />
              <button className="btn primary" type="button" onClick={() => router.push("/auth")}>
                Sign in
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="hero">
        <div className="container hero-grid">
          <section className="card hero-copy">
            <div className="persona-toggle" role="tablist" aria-label="Choose workflow perspective">
              {(Object.keys(personaContent) as Persona[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={persona === key}
                  className={`persona-toggle-btn${persona === key ? " active" : ""}`}
                  onClick={() => setPersona(key)}
                >
                  {personaContent[key].label} workflow
                </button>
              ))}
            </div>
            <div className="pills">
              {content.pills.map((pill) => (
                <span className="pill" key={pill}>
                  {pill}
                </span>
              ))}
            </div>
            <p className="eyebrow">{content.eyebrow}</p>
            <h1>{content.headline}</h1>
            <p className="hero-sub">{content.subhead}</p>
            <div className="hero-actions">
              <button
                className="btn primary"
                type="button"
                onClick={() => router.push(content.primaryRoute)}
              >
                {content.primaryCta}
              </button>
              <a className="btn" href="#workflow">
                {content.secondaryCta}
              </a>
            </div>
            <p className="fineprint">{content.fineprint}</p>
          </section>

          <section className="card network-card" aria-label="Live network preview">
            <div className={`radar${persona === "pilot" ? " radar-pilot" : ""}`}>
              <span className="ring ring-one" />
              <span className="ring ring-two" />
              <span className="airport">{content.networkCenter}</span>
              <span className="pin pin-one">{content.networkPins[0]}</span>
              <span className="pin pin-two">{content.networkPins[1]}</span>
              <span className="pin pin-three">{content.networkPins[2]}</span>
            </div>
            <div className="network-footer">
              {content.networkStats.map(([value, label]) => (
                <div key={label}>
                  <b>{value}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <section className="section" id="workflow">
        <div className="container">
          <div className="section-title">
            <div className="persona-toggle persona-toggle-inline" role="tablist" aria-label="Choose workflow perspective">
              {(Object.keys(personaContent) as Persona[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={persona === key}
                  className={`persona-toggle-btn${persona === key ? " active" : ""}`}
                  onClick={() => setPersona(key)}
                >
                  {personaContent[key].label}
                </button>
              ))}
            </div>
            <h2>{content.workflowTitle}</h2>
            <p>{content.workflowIntro}</p>
          </div>
          <div className="workflow">
            {content.workflowSteps.map((step, index) => (
              <div className="card workflow-step" key={step.title}>
                <span className="tag">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="container">
          <div className="section-title">
            <h2>{content.featuresTitle}</h2>
            <p>{content.featuresIntro}</p>
          </div>
          <div className="grid">
            {content.capabilities.map(([title, body]) => (
              <article className="card feature-card" key={title}>
                <span className="tag">CrewLinkAI · {content.label}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section newsletter-band" id="newsletter">
        <div className="container">
          <div className="card newsletter-card">
            <div className="newsletter-copy">
              <span className="tag">Stay in the loop</span>
              <h2>Join our newsletter</h2>
              <p>
                Get product updates, staffing workflow tips, and aviation
                hiring insights from the CrewLinkAI team. No spam — unsubscribe
                anytime.
              </p>
            </div>
            <div className="newsletter-form-wrap">
              {newsletterStatus.type === "success" && (
                <div className="status success">{newsletterStatus.message}</div>
              )}
              {newsletterStatus.type === "error" && (
                <div className="status error">{newsletterStatus.message}</div>
              )}
              <form
                className="newsletter-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setNewsletterSubmitting(true);
                  setNewsletterStatus({ type: null, message: "" });

                  try {
                    await subscribeNewsletter(newsletterEmail.trim());
                    setNewsletterStatus({
                      type: "success",
                      message:
                        "You're on the list. Watch your inbox for CrewLinkAI updates.",
                    });
                    setNewsletterEmail("");
                  } catch (error) {
                    setNewsletterStatus({
                      type: "error",
                      message:
                        error instanceof Error
                          ? error.message
                          : "Sorry, we couldn't sign you up. Please try again.",
                    });
                  } finally {
                    setNewsletterSubmitting(false);
                  }
                }}
              >
                <label className="sr-only" htmlFor="newsletter-email">
                  Email address
                </label>
                <input
                  id="newsletter-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={newsletterEmail}
                  onChange={(event) => setNewsletterEmail(event.target.value)}
                  required
                  disabled={newsletterSubmitting}
                />
                <button
                  className="btn primary"
                  type="submit"
                  disabled={newsletterSubmitting}
                >
                  {newsletterSubmitting ? "Joining..." : "Join newsletter"}
                </button>
              </form>
              <p className="fineprint newsletter-fineprint">
                By subscribing, you agree to receive occasional emails from{" "}
                {CREWLINK_AI_LEGAL_NAME}. We do not sell your information.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="contact">
        <div className="container contact-grid">
          <div className="section-title">
            <h2>Request a CrewLinkAI demo.</h2>
            <p>
              Tell us about your fleet, staffing workflow, and the pilot coverage
              gaps you want CrewLinkAI to solve.
            </p>
          </div>
          <form
            className="card contact-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setStatus("Sending...");
              try {
                await createContact(form);
                setStatus("Thanks. We received your request.");
                setForm({ name: "", email: "", organization: "", message: "" });
              } catch (error) {
                setStatus(
                  error instanceof Error
                    ? error.message
                    : "Contact API is not configured yet.",
                );
              }
            }}
          >
            <input
              required
              placeholder="Name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <input
              placeholder="Operator / flight department"
              value={form.organization}
              onChange={(event) => setForm({ ...form, organization: event.target.value })}
            />
            <textarea
              placeholder="Fleet types, hiring volume, urgent coverage needs..."
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
            />
            <button className="btn primary" type="submit">
              Send
            </button>
            <p className="fineprint">
              By submitting, you agree to be contacted by Aviation AI
              Solutions™. We do not sell your information.
            </p>
            {status && <p className="fineprint">{status}</p>}
          </form>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-brand">
            CrewLinkAI<span aria-hidden="true">™</span>
          </div>
          <p className="fineprint">
            © {new Date().getFullYear()} {CREWLINK_AI_LEGAL_NAME}. All rights
            reserved.
            <br />A product of Aviation AI Solutions — {CREWLINK_AI_LEGAL_NAME}.
          </p>
        </div>
      </footer>
    </div>
  );
}
