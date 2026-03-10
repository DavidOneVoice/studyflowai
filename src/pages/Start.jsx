import "./Start.css";

export default function Start() {
  return (
    <div className="start">
      <section className="startHero card">
        <div className="startHeroText">
          <div className="startKicker">
            <span className="pill">Smart Planning</span>
            <span className="pill pillAlt">AI Learning</span>
          </div>

          <h1 className="startTitle">
            Study <span className="gradA">smarter</span>, not{" "}
            <span className="gradB">harder</span>.
          </h1>

          <p className="startLead">
            StudyFlow AI helps you organize your study time, generate smart
            summaries from your notes, and practice with AI-generated quizzes.
            Everything you need to prepare effectively in one simple app.
          </p>

          <div className="startActions">
            <button
              className="primaryBtn"
              onClick={() => (window.location.hash = "#/plan")}
            >
              Create Study Plan
            </button>

            <button
              className="ghostBtn"
              onClick={() => (window.location.hash = "#/practice")}
            >
              Practice Quiz
            </button>
            <button
              className="primaryBtn"
              onClick={() => (window.location.hash = "#/summary")}
            >
              Generate Summary
            </button>
          </div>

          <div className="startGrid">
            <div className="infoCard">
              <h2 className="sectionTitle">Plan your study time</h2>
              <p>
                Enter your exam dates and available study hours to generate a
                balanced study schedule automatically.
              </p>
            </div>

            <div className="infoCard">
              <h2 className="sectionTitle">Generate AI notes</h2>
              <p>
                Upload or paste your course material and get clear summaries
                that make revision faster and easier.
              </p>
            </div>

            <div className="infoCard">
              <h2 className="sectionTitle">Practice with quizzes</h2>
              <p>
                Turn your study material into multiple-choice quizzes and test
                your understanding anytime.
              </p>
            </div>
          </div>
        </div>

        <div className="startHeroArt" aria-hidden="true">
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

          <div className="miniCard">
            <div className="miniDot" />
            <div>
              <div className="miniTitle">Today’s Study</div>
              <div className="miniText">Physics • Calculus</div>
            </div>
          </div>

          <div className="miniCard miniCard2">
            <div className="miniTitle">AI Tip</div>
            <div className="miniText">
              Review summaries first, then test yourself with quizzes.
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="featureCard">
          <h3>Smart Study Planner</h3>
          <p>
            Automatically generate study schedules based on exam dates and
            available time.
          </p>
        </div>

        <div className="featureCard">
          <h3>AI Summaries</h3>
          <p>
            Convert long study materials into structured notes you can review
            quickly.
          </p>
        </div>

        <div className="featureCard">
          <h3>Quiz Practice</h3>
          <p>
            Create and take practice quizzes generated directly from your
            learning material.
          </p>
        </div>
      </section>
    </div>
  );
}
