import React from "react";
import { Link } from "react-router-dom";

export default function PSSQuiz() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg max-w-xl w-full p-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 text-center">
          Quiz Instructions
        </h1>

        <ul className="text-gray-600 space-y-3 text-sm leading-relaxed">
          <li className="flex gap-2">
            <span className="text-gray-400 font-medium">1.</span>
            Read each question carefully before selecting your answer.
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400 font-medium">2.</span>
            Select the best answer from the given options.
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400 font-medium">3.</span>
            You cannot go back to a previous question once answered.
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400 font-medium">4.</span>
            Your score will be shown at the end of the quiz.
          </li>
        </ul>

        <div className="pt-2 text-center">
          <Link
            to = "/PSSQuiz-Begin"
            className="inline-block bg-gray-900 text-white text-sm font-medium px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Start Quiz
          </Link>
        </div>
      </div>
    </div>
  );
}