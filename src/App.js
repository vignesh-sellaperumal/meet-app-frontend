import {
  Route,
  RouterProvider,
  Routes,
  createBrowserRouter,
} from "react-router-dom";
import LandingPage from "./containers/landing_page/LandingPage";
import MeetingRoom from "./containers/meeting_room/MeetingRoom";

function Root() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/:meetId" element={<MeetingRoom />} />
      </Routes>
    </div>
  );
}

const router = createBrowserRouter([{ path: "*", Component: Root }]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
