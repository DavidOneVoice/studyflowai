import "./Start.css";

/**
 * Start (landing) page:
 * - Introduces what CramLess does
 * - Gives quick steps for first-time users
 * - Displays simple decorative hero artwork (purely visual)
 *
 * Note: This is a presentational component (no state, no side effects).
 */
export default function Start() {
  return (
    <div className="start">
      <section className="startHero card">
        <div className="startHeroText">
          {/* Short feature kicker pills */}
          <div className="startKicker">
            <span className="pill">Study smarter</span>
            <span className="pill pillAlt">Practice better</span>
          </div>

          {/* Main headline (uses spans for gradient styling) */}
          <h1 className="startTitle">
            Your <span className="gradA">smart</span> study planner &amp;{" "}
            <span className="gradB">quiz</span> generator.
          </h1>

          {/* Product description */}
          <p className="startLead">
            CramLess helps students plan study time intelligently (based on
            course workload and exam dates) and practice what they learn using
            generated quizzes and flashcards.
          </p>

          <div className="startGrid">
            <div className="infoCard">
              <h2 className="sectionTitle">What this is for</h2>
              <p>
                Build a realistic plan, stay consistent, and test yourself with
                practice questions generated from your material.
              </p>
            </div>

            <div className="infoCard">
              <h2 className="sectionTitle">How to start</h2>

              {/* Simple onboarding steps */}
              <ol className="steps">
                <li>Add your courses and exam dates.</li>
                <li>
                  Select your available study days and preferred study times.
                </li>
                <li>Generate a balanced study schedule.</li>
                <li>
                  Paste your course material to generate practice quizzes.
                </li>
              </ol>
            </div>
          </div>

          <p className="footerNote">
            Use the navigation at the top to open the Study Planner or Quiz
            Builder.
          </p>
        </div>

        {/* Decorative / non-interactive art section */}
        <div className="startHeroArt" aria-hidden="true">
          {/* SVG “original” background art (purely decorative) */}
          <div className="orb orb1" />
          <div className="orb orb2" />
          <div className="orb orb3" />

          <svg className="gridlines" viewBox="0 0 600 420" fill="none">
            <path
              d="M20 70H580M20 140H580M20 210H580M20 280H580M20 350H580"
              stroke="rgba(255,255,255,.08)"
              strokeWidth="1"
            />
            <path
              d="M80 20V400M160 20V400M240 20V400M320 20V400M400 20V400M480 20V400"
              stroke="rgba(255,255,255,.06)"
              strokeWidth="1"
            />
          </svg>

          {/* Mini UI-style cards for visual emphasis */}
          <div className="miniCard">
            <div className="miniDot" />
            <div>
              <div className="miniTitle">Today’s focus</div>
              <div className="miniText">Planner • Quiz practice</div>
            </div>
          </div>

          <div className="miniCard miniCard2">
            <div className="miniTitle">Tip</div>
            <div className="miniText">
              Start with 10–20 questions. Increase as you improve.
            </div>
          </div>
        </div>
      </section>

      {/* Footer credit information */}
      <footer className="creditPanel">
        <div className="creditInner">
          <div className="creditLine">
            <span className="creditLabel">Developed by</span>
            <span className="creditName">Olubukola Deborah Odedairo</span>
          </div>

          <div className="creditLine muted">
            Final project for an <strong>MS</strong> at{" "}
            <strong>St. Mary’s University</strong>
          </div>
        </div>
      </footer>
    </div>
  );
}
