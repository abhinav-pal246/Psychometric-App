import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./styles.css";
import Hero from "./components/hero.jsx";
import Navbar from "./components/Navbar.jsx";
import PSSQuiz from "./components/PSSQuiz.jsx";
import Quizpage from "./components/Quizpage.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

function App() {
const router = createBrowserRouter([
    {
      path: "/",
      element: (
        <>
         
          <Navbar />
          <Hero/>
        </>
      ),
    },
    {
      path: "/PSS-10",
      element: (
        <>
          <PSSQuiz/>
        </>
      ),
    },
    {
      path: "/PSSQuiz-Begin",
      element: (
        <>
          <Quizpage/>
        </>
      ),
    },
    {
      path: "/blog",
      element: (
        <>
         
        </>
      ),
    },
  ]);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
