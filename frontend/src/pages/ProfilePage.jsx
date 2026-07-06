import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  BadgeCheck,
  CreditCard,
  Clock,
  Save,
  GraduationCap,
  BriefcaseBusiness,
  BookOpen,
  Target,
} from "lucide-react";

import "./ProfilePage.css";

function ProfilePage() {
  const navigate = useNavigate();

  const accountType =
    localStorage.getItem("vidgen_account_type") || "student";

  const [name, setName] = useState(
    localStorage.getItem("vidgen_user_name") || "Manohar"
  );

  const [email, setEmail] = useState(
    localStorage.getItem("vidgen_user_email") || ""
  );

  const [mobile, setMobile] = useState(
    localStorage.getItem("vidgen_user_mobile") || ""
  );

  const [college, setCollege] = useState(
    localStorage.getItem("vidgen_student_college") || ""
  );

  const [branch, setBranch] = useState(
    localStorage.getItem("vidgen_student_branch") || ""
  );

  const [semester, setSemester] = useState(
    localStorage.getItem("vidgen_student_semester") || ""
  );

  const [academicGoal, setAcademicGoal] = useState(
    localStorage.getItem("vidgen_student_goal") || ""
  );

  const [profession, setProfession] = useState(
    localStorage.getItem("vidgen_learner_profession") || ""
  );

  const [interestArea, setInterestArea] = useState(
    localStorage.getItem("vidgen_learner_interest") || ""
  );

  const [experience, setExperience] = useState(
    localStorage.getItem("vidgen_learner_experience") || ""
  );

  const [learningGoal, setLearningGoal] = useState(
    localStorage.getItem("vidgen_learner_goal") || ""
  );

  const [saved, setSaved] = useState(false);

  const plan =
    localStorage.getItem("vidgen_plan") || "Free";

  const dailyHours =
    localStorage.getItem("vidgen_daily_hours") || "4";

  const getTodayKey = () => {
    return new Date().toISOString().split("T")[0];
  };

  const getUsedHoursToday = () => {
    const today = getTodayKey();
    const savedDate = localStorage.getItem("vidgen_usage_date");

    if (savedDate !== today) {
      return 0;
    }

    return Number(localStorage.getItem("vidgen_used_hours") || "0");
  };

  const usedHours = getUsedHoursToday();
  const remainingHours = Math.max(0, Number(dailyHours) - usedHours);

  const handleSave = () => {
    localStorage.setItem("vidgen_user_name", name);
    localStorage.setItem("vidgen_user_email", email);
    localStorage.setItem("vidgen_user_mobile", mobile);

    if (accountType === "student") {
      localStorage.setItem("vidgen_student_college", college);
      localStorage.setItem("vidgen_student_branch", branch);
      localStorage.setItem("vidgen_student_semester", semester);
      localStorage.setItem("vidgen_student_goal", academicGoal);
    } else {
      localStorage.setItem("vidgen_learner_profession", profession);
      localStorage.setItem("vidgen_learner_interest", interestArea);
      localStorage.setItem("vidgen_learner_experience", experience);
      localStorage.setItem("vidgen_learner_goal", learningGoal);
    }

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2200);
  };

  return (
    <div className="profile-page">
      <button
        className="profile-back"
        onClick={() => navigate("/dashboard")}
      >
        <ArrowLeft size={18} />
        Back to Dashboard
      </button>

      <main className="profile-layout">
        <section className="profile-hero-card">
          <div className="profile-hero-top">
            <div className="big-avatar">
              {name.charAt(0).toUpperCase()}
            </div>

            <h1>{name || "VidGen User"}</h1>

            <p>
              Manage your account details, active plan, daily learning usage,
              and personalized profile information.
            </p>

            <div className="profile-badges">
              <span>
                <BadgeCheck size={15} />
                {accountType === "learner" ? "Learner" : "Student"}
              </span>

              <span>
                <CreditCard size={15} />
                {plan} Plan
              </span>
            </div>
          </div>

          <div className="extended-profile-box">
            <div className="extended-title">
              {accountType === "student" ? (
                <GraduationCap size={18} />
              ) : (
                <BriefcaseBusiness size={18} />
              )}

              <div>
                <h2>
                  {accountType === "student"
                    ? "Academic Details"
                    : "Professional Details"}
                </h2>

                <p>
                  {accountType === "student"
                    ? "Personalize VidGen AI for your college and exam goals."
                    : "Personalize VidGen AI for your career and learning goals."}
                </p>
              </div>
            </div>

            {accountType === "student" ? (
              <div className="extended-form">
                <label>
                  College / Institution
                  <div className="profile-input">
                    <GraduationCap size={17} />
                    <input
                      type="text"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="Example: RCEE Eluru"
                    />
                  </div>
                </label>

                <label>
                  Branch / Course
                  <div className="profile-input">
                    <BookOpen size={17} />
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="Example: ECE"
                    />
                  </div>
                </label>

                <label>
                  Semester / Year
                  <div className="profile-input">
                    <Clock size={17} />
                    <input
                      type="text"
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      placeholder="Example: 2nd Semester"
                    />
                  </div>
                </label>

                <label>
                  Academic Goal
                  <div className="profile-input">
                    <Target size={17} />
                    <input
                      type="text"
                      value={academicGoal}
                      onChange={(e) => setAcademicGoal(e.target.value)}
                      placeholder="Example: Score high in semester exams"
                    />
                  </div>
                </label>
              </div>
            ) : (
              <div className="extended-form">
                <label>
                  Profession / Role
                  <div className="profile-input">
                    <BriefcaseBusiness size={17} />
                    <input
                      type="text"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="Example: Student, Creator, Developer"
                    />
                  </div>
                </label>

                <label>
                  Learning Interest
                  <div className="profile-input">
                    <BookOpen size={17} />
                    <input
                      type="text"
                      value={interestArea}
                      onChange={(e) => setInterestArea(e.target.value)}
                      placeholder="Example: AI, Business, Coding"
                    />
                  </div>
                </label>

                <label>
                  Experience Level
                  <div className="profile-input">
                    <Clock size={17} />
                    <input
                      type="text"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      placeholder="Example: Beginner / Intermediate"
                    />
                  </div>
                </label>

                <label>
                  Learning Goal
                  <div className="profile-input">
                    <Target size={17} />
                    <input
                      type="text"
                      value={learningGoal}
                      onChange={(e) => setLearningGoal(e.target.value)}
                      placeholder="Example: Learn faster from podcasts"
                    />
                  </div>
                </label>
              </div>
            )}
          </div>
        </section>

        <section className="profile-card">
          <div className="profile-section-title">
            <h2>Account Information</h2>
            <p>Update your basic profile details.</p>
          </div>

          <div className="profile-form">
            <label>
              Full Name
              <div className="profile-input">
                <User size={17} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>
            </label>

            <label>
              Email Address
              <div className="profile-input">
                <Mail size={17} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
            </label>

            <label>
              Mobile Number
              <div className="profile-input">
                <Phone size={17} />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Enter your mobile number"
                />
              </div>
            </label>

            <button className="save-profile-btn" onClick={handleSave}>
              <Save size={17} />
              Save Changes
            </button>

            {saved && (
              <div className="save-success">
                Profile updated successfully.
              </div>
            )}
          </div>
        </section>

        <section className="profile-card">
          <div className="profile-section-title">
            <h2>Plan & Daily Usage</h2>
            <p>Your current VidGen AI learning access.</p>
          </div>

          <div className="usage-overview">
            <div className="usage-box">
              <Clock size={20} />
              <span>Daily Limit</span>
              <strong>{dailyHours} hrs/day</strong>
            </div>

            <div className="usage-box">
              <Clock size={20} />
              <span>Used Today</span>
              <strong>{usedHours} hrs</strong>
            </div>

            <div className="usage-box">
              <Clock size={20} />
              <span>Remaining</span>
              <strong>{remainingHours} hrs</strong>
            </div>
          </div>

          <button
            className="manage-plan-btn"
            onClick={() => navigate("/plans")}
          >
            Manage Plan
          </button>
        </section>
      </main>
    </div>
  );
}

export default ProfilePage;