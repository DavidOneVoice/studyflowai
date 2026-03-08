import { useMemo, useState, useEffect } from "react";
import ConfirmModal from "../common/ConfirmModal";
import "./PlannerCoursesCard.css";

/**
 * Displays the "Your Courses" step in the planner:
 * - Lists courses (with optional hiding/cleanup for expired exams)
 * - Lets users remove courses
 * - Shows linked quizzes per course and allows launching a quiz
 * - Triggers schedule generation and clearing
 */
export default function PlannerCoursesCard({
  courses = [],
  quizSets = [],
  takingQuizSetId,
  onRemoveCourse,
  onTakeQuizFromPlanner,
  onRemoveExpiredCourses,
  quizError,
  scheduleError,
  onGenerateSchedule,
  onClearSchedule,
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [hideExpired, setHideExpired] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  // Compute today's date (YYYY-MM-DD) once, used to determine whether exam dates have passed.
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  /**
   * Build a set of course IDs considered "expired" (examDate earlier than today).
   * Using a Set makes lookups fast when rendering the table.
   */
  const expiredIds = useMemo(() => {
    return new Set(
      (courses || [])
        .filter((c) => String(c.examDate || "") < todayIso)
        .map((c) => c.id),
    );
  }, [courses, todayIso]);

  const expiredCount = expiredIds.size;

  /**
   * Optionally filter out expired courses from the list.
   * Users can toggle this with "Hide expired".
   */
  const visibleCourses = useMemo(() => {
    if (!hideExpired) return courses;
    return (courses || []).filter((c) => !expiredIds.has(c.id));
  }, [courses, hideExpired, expiredIds]);

  const hasCourses = (courses || []).length > 0;

  /**
   * Auto-dismiss toast notifications after a short delay.
   * (This is used after cleaning up expired courses.)
   */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="pccCard card">
      <header className="pccHeader">
        <div>
          <div className="pccBadge">Step 3</div>
          <h3 className="pccTitle">Your Courses</h3>
          <p className="pccSub">
            Manage courses, launch linked quizzes, then generate your schedule.
          </p>
        </div>

        <div className="pccHeaderActions">
          {/* Expired-course controls only appear if there is at least one expired course */}
          {expiredCount > 0 && (
            <>
              <label className="pccToggle">
                <input
                  type="checkbox"
                  checked={hideExpired}
                  onChange={(e) => setHideExpired(e.target.checked)}
                />
                Hide expired ({expiredCount})
              </label>

              {/* Cleanup removes expired courses and their schedule entries */}
              <button
                className="dangerBtn pccDangerSoft"
                type="button"
                onClick={() => setShowCleanupConfirm(true)}
                title="Remove expired courses and their schedule entries"
              >
                Clean up expired
              </button>
            </>
          )}

          {/* Schedule generation is disabled until at least one course exists */}
          <button
            className="primaryBtn"
            type="button"
            onClick={onGenerateSchedule}
            disabled={!hasCourses}
            title={!hasCourses ? "Add at least one course first" : ""}
          >
            Generate Schedule
          </button>

          {/* Clearing schedule requires confirmation to prevent accidental loss */}
          <button
            className="navBtn"
            type="button"
            onClick={() => setShowClearConfirm(true)}
          >
            Clear Schedule
          </button>
        </div>
      </header>

      {/* Empty state when no courses have been added */}
      {!hasCourses ? (
        <div className="pccEmpty">
          <div className="pccEmptyIcon" aria-hidden="true" />
          <div>
            <div className="pccEmptyTitle">No courses added yet</div>
            <div className="pccEmptySub">
              Go back to Scheduler Setup to add your first course.
            </div>
          </div>
        </div>
      ) : (
        <div className="table pccTable">
          <div className="row head">
            <div>Course</div>
            <div>Exam Date</div>
            <div>Priority</div>
            <div>Actions</div>
          </div>

          {visibleCourses.map((c) => {
            const isExpired = expiredIds.has(c.id);

            // Identify quizzes linked to this course by courseId.
            const courseQuizzes = (quizSets || []).filter(
              (q) => q.courseId === c.id,
            );

            return (
              <div
                key={c.id}
                className={`pccCourseBlock ${isExpired ? "isExpired" : ""}`}
              >
                <div className="row">
                  <div className="pccCourseName" title={c.name}>
                    {c.name}
                    {/* Visual tag to indicate the exam date has passed */}
                    {isExpired && (
                      <span className="pccTagExpired">Exam Passed</span>
                    )}
                  </div>

                  <div>{c.examDate || "-"}</div>

                  <div className="pccPriority">{c.workload}</div>

                  <div className="right">
                    <button
                      className="dangerBtn"
                      type="button"
                      onClick={() => onRemoveCourse(c.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Render linked quizzes for this course, if any exist */}
                {courseQuizzes.length > 0 && (
                  <div className="pccLinked">
                    <div className="pccLinkedTitle">Linked Quizzes</div>

                    <div className="pccLinkedButtons">
                      {courseQuizzes.map((q) => (
                        <button
                          key={q.id}
                          className="navBtn"
                          type="button"
                          // Disable quiz launch when the course is expired or the quiz is currently generating.
                          disabled={isExpired || takingQuizSetId === q.id}
                          // Fixed quiz length of 10 used for planner launches.
                          onClick={() => onTakeQuizFromPlanner(q.id, 10)}
                          title={isExpired ? "Exam date has passed" : ""}
                        >
                          {isExpired
                            ? `Exam Passed: ${q.title}`
                            : takingQuizSetId === q.id
                              ? "Generating…"
                              : `Take Quiz: ${q.title}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Display any quiz/schedule errors returned from parent logic */}
      {(quizError || scheduleError) && (
        <div className="pccErrors">
          {quizError && <div className="errorBox">{quizError}</div>}
          {scheduleError && <div className="errorBox">{scheduleError}</div>}
        </div>
      )}

      <p className="footerNote pccFoot">
        Tip: Priority helps the scheduler allocate more time to heavier or more
        important courses.
      </p>

      {/* Confirmation modal for clearing the generated schedule */}
      <ConfirmModal
        open={showClearConfirm}
        title="Clear schedule?"
        message="This will delete your generated timetable. Your courses and quizzes will remain."
        confirmText="Yes, clear"
        cancelText="Cancel"
        danger
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={() => {
          onClearSchedule?.();
          setShowClearConfirm(false);
        }}
      />

      {/* Confirmation modal for removing expired courses + associated schedule entries */}
      <ConfirmModal
        open={showCleanupConfirm}
        title="Clean up expired courses?"
        message="This will remove all courses whose exam date has passed, and also remove their schedule sessions. This cannot be undone."
        confirmText="Yes, remove expired"
        cancelText="Cancel"
        danger
        onCancel={() => setShowCleanupConfirm(false)}
        onConfirm={() => {
          // Parent returns the number of removed courses (used for feedback).
          const removed = onRemoveExpiredCourses?.() || 0;

          // Show a short toast if any courses were removed.
          if (removed > 0) {
            setToast(
              `${removed} expired course${removed > 1 ? "s" : ""} removed`,
            );
          }

          setShowCleanupConfirm(false);
        }}
      />

      {/* Simple toast feedback (auto-dismissed by the effect above) */}
      {toast && <div className="pccToast">{toast}</div>}
    </div>
  );
}
