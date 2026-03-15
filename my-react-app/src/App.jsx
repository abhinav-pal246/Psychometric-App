import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useState } from "react";
import "./styles.css";
import Hero from "./components/hero.jsx";
import Navbar from "./components/Navbar.jsx";

function App() {
  const [count, setCount] = useState(0);
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
          
        </>
      ),
    },
    {
      path: "/contactus",
      element: (
        <>
          
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
    <div>
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
