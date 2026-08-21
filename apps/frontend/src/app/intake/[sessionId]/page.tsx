'use client';
import { TitleSetter } from '@/components/ui/title-setter';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSessionStore } from '@/stores/session-store';
import { useFaceStore } from '@/stores/face-store';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useFaceEmbedding } from '@/hooks/useFaceEmbedding';
import { useLivenessDetection } from '@/hooks/useLivenessDetection';
import { useIntakeConversation } from '@/hooks/useIntakeConversation';
import { useMobileDetection } from '@/hooks/useMobileDetection';
import { useLanguage } from '@/hooks/useLanguage';
import { socketService } from '@/services/socket';
import { cachePatient, cacheSession } from '@/services/db';
import { cn } from '@/lib/utils';
import { getSessionStatusInfo } from '@/lib/session-status';
import { logger } from '@/lib/logger';
import { DarkModeToggle } from '@/components/ui/dark-mode-toggle';
import { Brand } from '@/components/ui/brand';
import { LanguageSelector } from '@/components/ui/language-selector';
import { FaceRegistrationDialog } from '@/components/face/FaceRegistrationDialog';
import { CameraPanel } from '@/components/intake/camera-panel';
import { CameraPhase } from '@/components/intake/camera-phase';
import { ConversationPhase } from '@/components/intake/conversation-phase';
import { BriefPhase } from '@/components/intake/brief-phase';
import { IntakeStepper } from '@/components/intake/intake-stepper';

type IntakePhase = 'camera' | 'detecting' | 'intake' | 'brief' | 'complete';

export default function IntakeSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const router = useRouter();
  const mobileInfo = useMobileDetection();
  const { locale, setLocale } = useLanguage();
  const {
    videoRef,
    isActive,
    startCamera,
    stopCamera,
    currentFacingMode,
    toggleCamera,
    devices,
    hasMultipleCameras: _hasMultipleCameras,
    error: cameraError,
  } = useCamera({
    facingMode: mobileInfo.isMobile ? 'environment' : 'user',
    isMobile: mobileInfo.isMobile,
  });

  const session = useSessionStore();
  const face = useFaceStore();

  const [phase, setPhase] = useState<IntakePhase>('camera');
  const [showRegistration, setShowRegistration] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({
    width: 640,
    height: 480,
  });
  const registrationAttemptedRef = useRef(false);
  const conversationStartedRef = useRef(false);

  // Kiosk stepper: Camera -> Identify -> Intake -> Brief (-> Complete)
  const STEP_INDEX: Record<IntakePhase, number> = {
    camera: 0,
    detecting: 1,
    intake: 2,
    brief: 3,
    complete: 3,
  };
  const STEP_LABELS = [
    { id: 'camera', label: 'Camera' },
    { id: 'identify', label: 'Identify' },
    { id: 'intake', label: 'Intake' },
    { id: 'brief', label: 'Brief' },
  ];

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [identifyFailed, setIdentifyFailed] = useState(false);

  function handleCancelSession() {
    setShowCancelConfirm(false);
    try {
      socketService.leaveSession(sessionId);
    } catch {
      // Socket may already be disconnected — leaving is best-effort.
    }
    session.reset();
    face.reset();
    router.push('/');
  }

  // ─── AI Intake Conversation ─────────────────────────────────────
  const conversation = useIntakeConversation(sessionId);

  // Sync conversation thinking state to the global store
  useEffect(() => {
    session.setIsAiThinking(conversation.isAiThinking);
  }, [conversation.isAiThinking]);

  // ─── MediaPipe Face Detection ────────────────────────────────
  const {
    result: detectionResult,
    isLoading: mpLoading,
    error: mpError,
    isFaceDetected,
    fps,
    startDetection,
    stopDetection,
  } = useFaceDetection({
    numFaces: 1,
    outputBlendshapes: false,
    outputFaceMatrix: false,
    autoStart: true,
    useCPUDelegate: mobileInfo.hasLimitedGPU,
  });

  // ─── Face Embedding & Identity Search ────────────────────────
  const {
    embedding,
    matchResult: _matchResult,
    isSearching: isSearchingEmbedding,
    error: _embeddingError,
    searchIdentity,
    generateFromLandmarks,
    registerEmbedding: _registerEmbedding,
    reset: _resetEmbedding,
  } = useFaceEmbedding();

  // ─── Liveness Detection ──────────────────────────────────────
  const {
    status: livenessStatus,
    blinkCount,
    ear: _ear,
    isAlive,
    startChallenge,
    processFrame: processLivenessFrame,
    reset: _resetLiveness,
  } = useLivenessDetection({
    requiredBlinks: 2,
    challengeTimeoutMs: 8000,
  });

  // Sync detection results to the face store
  useEffect(() => {
    if (detectionResult) {
      face.setFaces([
        {
          id: 'face-0',
          box: { x: 0, y: 0, width: 1, height: 1 },
          landmarks: detectionResult.landmarks,
          confidence: isFaceDetected ? 0.95 : 0,
        },
      ]);
      face.setFps(fps);

      // Process liveness on each frame
      processLivenessFrame(detectionResult.landmarks);
    } else {
      face.setFaces([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectionResult, isFaceDetected, fps]);

  // When camera becomes active, wire up MediaPipe detection
  useEffect(() => {
    if (isActive && videoRef.current) {
      startDetection(videoRef.current);
      face.setStatus('detecting');
      setPhase('detecting');

      // Store video dimensions for the canvas overlay
      setVideoDimensions({
        width: videoRef.current.videoWidth || 640,
        height: videoRef.current.videoHeight || 480,
      });

      // Auto-start liveness challenge
      setTimeout(() => startChallenge(), 1000);
    } else {
      stopDetection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // ─── Identify-failure recovery: if no match within 25s, offer help ───
  useEffect(() => {
    if (phase !== 'detecting') {
      setIdentifyFailed(false);
      return;
    }
    const t = setTimeout(() => {
      if (face.status !== 'matched' && !showRegistration) {
        setIdentifyFailed(true);
      }
    }, 25000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, face.status, showRegistration]);

  // ─── Identity Search (when face is stable and liveness verified) ───
  useEffect(() => {
    if (isAlive && detectionResult && isFaceDetected && !registrationAttemptedRef.current) {
      registrationAttemptedRef.current = true;

      const runIdentitySearch = async () => {
        try {
          const result = await searchIdentity(detectionResult.landmarks);

          if (result.isNewPatient) {
            // No match — show registration dialog
            setShowRegistration(true);
          } else {
            // Match found!
            face.setStatus('matched');
            face.setMatchResult(result);
            setIdentifyFailed(false);
            session.setFaceMatched(true);
            session.setStatus('face_matched');

            // Fetch patient details
            try {
              await import('@/services/api').then((m) =>
                m.dashboardApi.getLatestBrief(result.patientId),
              );
              session.setPatient({
                id: result.patientId,
                name: result.patientName ?? 'Patient',
                dob: '',
                mobile: '',
              });
            } catch {
              // Patient found in Qdrant but not yet in intake records
              session.setPatient({
                id: result.patientId,
                name: result.patientName ?? 'Returning Patient',
                dob: '',
                mobile: '',
              });
            }

            // Notify through WebSocket
            socketService.joinSession(sessionId);

            // Cache patient + session for offline resilience
            void cachePatient({
              id: result.patientId,
              name: result.patientName ?? 'Patient',
              dob: '',
              mobile: '',
              lastSyncedAt: new Date().toISOString(),
              data: {},
            }).catch(() => {});
            void cacheSession({
              id: sessionId,
              patientId: result.patientId,
              status: 'FACE_MATCHED',
              startedAt: new Date().toISOString(),
              localData: {},
            }).catch(() => {});

            // Auto-start the AI intake conversation
            if (!conversationStartedRef.current) {
              conversationStartedRef.current = true;
              conversation.startConversation(
                result.patientName ?? 'Patient',
                result.patientId,
                locale,
              );
            }
            setPhase('intake');

            // Generate and store embedding for future matches
            const emb = generateFromLandmarks(detectionResult.landmarks);
            face.setEmbedding(emb);
          }
        } catch (err) {
          logger.error('Identity search failed', err);
          face.setError('Face identification failed. Please try again.');
          registrationAttemptedRef.current = false;
        }
      };

      runIdentitySearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAlive, isFaceDetected, detectionResult]);

  useEffect(() => {
    const unsubStatus = socketService.onSessionStatus((data) => {
      const statusData = data as { status?: string };
      session.setStatus((statusData.status ?? 'idle') as never);
    });

    const unsubBrief = socketService.onBriefReady((data) => {
      session.setBrief({ id: data.briefId });
      setPhase('brief');
    });

    return () => {
      unsubStatus();
      unsubBrief();
      // Reset conversation start flag on unmount to allow restart on re-entry
      conversationStartedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCompleteIntake() {
    try {
      await conversation.completeIntake();
      setPhase('brief');
    } catch {
      // Error is handled by the hook's internal toast — stay on intake phase
    }
  }

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <TitleSetter title="Intake Session" />
      {/* Skip link for keyboard users */}
      <a
        href="#intake-main"
        className="focus:bg-jeevandata-500 sr-only z-[60] focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 sm:px-6 sm:py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Brand href={null} compact />
            <div>
              <h1 className="text-sm font-semibold text-slate-900 dark:text-white">
                Intake Session
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {session.patient?.name ?? 'Unknown Patient'}
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          {(phase === 'camera' || phase === 'detecting') && (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Cancel session
            </button>
          )}
          <LanguageSelector currentLocale={locale} onLocaleChange={setLocale} compact />
          <DarkModeToggle />
          <span
            role="status"
            aria-live="polite"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
              getSessionStatusInfo(session.status).chipClass,
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                getSessionStatusInfo(session.status).dotClass,
              )}
            />
            {getSessionStatusInfo(session.status).label}
          </span>
        </div>
      </header>

      {/* Kiosk step progress */}
      <div className="border-b border-slate-200 bg-white px-3 py-2.5 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
        <IntakeStepper
          steps={STEP_LABELS}
          currentIndex={STEP_INDEX[phase]}
          className="mx-auto max-w-3xl"
        />
      </div>

      <main
        id="intake-main"
        className={cn('flex flex-1 gap-6 overflow-hidden p-6', mobileInfo.isMobile && 'flex-col')}
      >
        {/* Left Panel */}
        <CameraPanel
          videoRef={videoRef}
          isActive={isActive}
          cameraError={cameraError}
          currentFacingMode={currentFacingMode}
          devices={devices}
          toggleCamera={toggleCamera}
          startCamera={startCamera}
          stopCamera={stopCamera}
          isMobile={mobileInfo.isMobile}
          detectionResult={detectionResult}
          videoDimensions={videoDimensions}
          isFaceDetected={isFaceDetected}
          faceStatus={face.status}
          faceConfidence={face.confidence}
          isSearching={isSearchingEmbedding}
          mpError={mpError}
          mpLoading={mpLoading}
          livenessStatus={livenessStatus}
          blinkCount={blinkCount}
          phase={phase}
        />

        {session.patient && phase !== 'camera' && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Identified Patient
            </h2>
            <div className="flex items-center gap-3">
              <div className="bg-jeevandata-100 text-jeevandata-600 dark:bg-jeevandata-900/50 dark:text-jeevandata-400 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold">
                {session.patient.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {session.patient.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  DOB: {session.patient.dob}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Right Panel — Transcript / Intake / Brief */}
        <div className="flex flex-1 flex-col gap-4">
          {phase === 'intake' && (
            <ConversationPhase
              sessionId={sessionId}
              patientName={session.patient?.name ?? 'Patient'}
              transcripts={session.transcripts}
              patientInput={conversation.patientInput}
              onPatientInputChange={conversation.setPatientInput}
              onSend={(text) => {
                if (text) conversation.sendPatientMessage(text);
              }}
              isAiThinking={conversation.isAiThinking}
              isComplete={conversation.isIntakeComplete}
              onComplete={handleCompleteIntake}
            />
          )}

          {phase === 'brief' && (
            <BriefPhase
              brief={
                session.brief
                  ? {
                      summary: (session.brief.summary as string) ?? '',
                      chiefComplaint: (session.brief.chiefComplaint as string) ?? '',
                      riskFlags: (session.brief.riskFlags as string[]) ?? [],
                      vitalsToCheck: (session.brief.vitalsToCheck as string[]) ?? [],
                      suggestedFollowups: (session.brief.suggestedFollowups as string[]) ?? [],
                      medicationsNote: (session.brief.medicationsNote as string) ?? '',
                      icd10Hints: (session.brief.icd10Hints as string[]) ?? [],
                    }
                  : null
              }
              patientName={session.patient?.name}
            />
          )}

          {phase === 'detecting' && identifyFailed && (
            <div className="flex flex-1 items-center justify-center">
              <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950/30">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  We couldn&apos;t identify you
                </h2>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                  Make sure you&apos;re facing the camera in good light, or ask a staff member for
                  help.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifyFailed(false);
                      registrationAttemptedRef.current = false;
                      if (isActive && videoRef.current) {
                        startDetection(videoRef.current);
                      }
                      setTimeout(() => startChallenge(), 500);
                    }}
                    className="bg-jeevandata-500 hover:bg-jeevandata-600 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifyFailed(false);
                      registrationAttemptedRef.current = false;
                      setShowRegistration(true);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Register as new patient
                  </button>
                </div>
              </div>
            </div>
          )}

          {phase === 'camera' && <CameraPhase />}
        </div>
      </main>

      {/* Cancel session confirmation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-session-title"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <h2
              id="cancel-session-title"
              className="text-base font-semibold text-slate-900 dark:text-white"
            >
              Cancel this session?
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              The patient will be returned to the welcome screen. Nothing from this session will be
              saved.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Keep session
              </button>
              <button
                type="button"
                onClick={handleCancelSession}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                Cancel session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Face Registration Dialog */}
      {showRegistration && (
        <FaceRegistrationDialog
          embedding={embedding}
          isOpen={showRegistration}
          onRegistered={(patientId, patientName) => {
            setShowRegistration(false);
            face.setStatus('matched');
            session.setFaceMatched(true);
            session.setStatus('face_matched');
            session.setPatient({
              id: patientId,
              name: patientName,
              dob: '',
              mobile: '',
            });
            void cachePatient({
              id: patientId,
              name: patientName,
              dob: '',
              mobile: '',
              lastSyncedAt: new Date().toISOString(),
              data: {},
            }).catch(() => {});
            void cacheSession({
              id: sessionId,
              patientId,
              status: 'FACE_MATCHED',
              startedAt: new Date().toISOString(),
              localData: {},
            }).catch(() => {});
            socketService.joinSession(sessionId);
            if (!conversationStartedRef.current) {
              conversationStartedRef.current = true;
              conversation.startConversation(patientName, patientId, locale);
            }
            setPhase('intake');
          }}
          onCancel={() => {
            setShowRegistration(false);
            registrationAttemptedRef.current = false;
          }}
        />
      )}
    </div>
  );
}
