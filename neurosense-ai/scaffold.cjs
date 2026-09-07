const fs = require('fs');
const path = require('path');

const dirs = [
  'src/components',
  'src/pages/Landing',
  'src/pages/Auth',
  'src/pages/Dashboard',
  'src/pages/Games',
  'src/pages/Progress',
  'src/pages/Risk',
  'src/pages/Therapy',
  'src/pages/Profile'
];

dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

const files = {
  'src/components/Navbar.jsx': `export default function Navbar() { return <div>Navbar</div>; }`,
  'src/components/Sidebar.jsx': `export default function Sidebar() { return <div>Sidebar</div>; }`,
  'src/pages/Landing/Landing.jsx': `export default function Landing() { return <div>Landing</div>; }`,
  'src/pages/Auth/Login.jsx': `export default function Login() { return <div>Login</div>; }`,
  'src/pages/Auth/Register.jsx': `export default function Register() { return <div>Register</div>; }`,
  'src/pages/Dashboard/Dashboard.jsx': `export default function Dashboard() { return <div>Dashboard</div>; }`,
  'src/pages/Games/MemoryGame.jsx': `export default function MemoryGame() { return <div>MemoryGame</div>; }`,
  'src/pages/Games/ReactionGame.jsx': `export default function ReactionGame() { return <div>ReactionGame</div>; }`,
  'src/pages/Games/WordRecall.jsx': `export default function WordRecall() { return <div>WordRecall</div>; }`,
  'src/pages/Progress/Progress.jsx': `export default function Progress() { return <div>Progress</div>; }`,
  'src/pages/Risk/RiskAssessment.jsx': `export default function RiskAssessment() { return <div>RiskAssessment</div>; }`,
  'src/pages/Therapy/Recommendations.jsx': `export default function Recommendations() { return <div>Recommendations</div>; }`,
  'src/pages/Profile/Profile.jsx': `export default function Profile() { return <div>Profile</div>; }`
};

Object.keys(files).forEach(f => fs.writeFileSync(f, files[f]));
