'use client';

export function CameraPhase() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="max-w-md text-center">
        <svg
          className="mx-auto mb-4 h-16 w-16 text-slate-300 dark:text-slate-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
          />
        </svg>
        <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
          Start Patient Intake
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Enable your camera to begin face detection.
        </p>
      </div>
    </div>
  );
}
