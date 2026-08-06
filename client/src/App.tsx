import { NavLink, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import TestRunner from "./pages/TestRunner";
import Results from "./pages/Results";
import History from "./pages/History";
import Progress from "./pages/Progress";

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark">TS</span>
            <span className="brand-name">Test Series</span>
            <span className="brand-sub">IBPS Clerk</span>
          </div>
          <nav className="topnav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
              Build Test
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => (isActive ? "active" : "")}>
              History
            </NavLink>
            <NavLink to="/progress" className={({ isActive }) => (isActive ? "active" : "")}>
              Progress
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/test/:testId" element={<TestRunner />} />
          <Route path="/results/:attemptId" element={<Results />} />
          <Route path="/history" element={<History />} />
          <Route path="/progress" element={<Progress />} />
        </Routes>
      </main>
    </div>
  );
}
