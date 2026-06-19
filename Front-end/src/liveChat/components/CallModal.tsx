import React, { useEffect, useRef } from 'react';
import { CallState } from '../types';

interface CallModalProps {
  callState: CallState;
  turnAvailable: boolean;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
}

const CallModal: React.FC<CallModalProps> = ({
  callState,
  turnAvailable,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleCamera,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (localVideoRef.current && callState.localStream) {
      localVideoRef.current.srcObject = callState.localStream;
    }
  }, [callState.localStream]);

  useEffect(() => {
    const stream = callState.remoteStream;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
  }, [callState.remoteStream]);

  if (callState.phase === 'idle') return null;

  const phaseLabel =
    callState.phase === 'incoming'
      ? 'Incoming encrypted call'
      : callState.phase === 'outgoing'
        ? 'Calling…'
        : callState.phase === 'connecting'
          ? 'Connecting…'
          : 'Encrypted call';

  return (
    <div className="livechat-call-overlay" role="dialog" aria-modal="true">
      <div className="livechat-call-modal glass-card">
        <h3>{phaseLabel}</h3>
        <p className="livechat-call-modal__hint">
          {turnAvailable
            ? 'Media routed via TURN relay. Signaling encrypted with your chat key.'
            : 'Using STUN for connectivity. Configure TURN on the server for strict relay mode.'}
        </p>

        <div className={`livechat-call-modal__video ${callState.mode}`}>
          {callState.mode === 'video' ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline className="livechat-call-remote" />
              <video ref={localVideoRef} autoPlay playsInline muted className="livechat-call-local" />
            </>
          ) : (
            <audio ref={remoteAudioRef} autoPlay className="livechat-call-audio" />
          )}
        </div>

        <div className="livechat-call-modal__controls">
          {callState.phase === 'incoming' && (
            <>
              <button type="button" className="btn btn--success" onClick={onAccept}>
                Accept
              </button>
              <button type="button" className="btn btn--danger" onClick={onReject}>
                Decline
              </button>
            </>
          )}
          {(callState.phase === 'outgoing' ||
            callState.phase === 'connecting' ||
            callState.phase === 'connected') && (
            <>
              <button type="button" className="btn btn--ghost" onClick={onToggleMute}>
                {callState.muted ? 'Unmute' : 'Mute'}
              </button>
              {callState.mode === 'video' && (
                <button type="button" className="btn btn--ghost" onClick={onToggleCamera}>
                  {callState.cameraOff ? 'Camera on' : 'Camera off'}
                </button>
              )}
              <button type="button" className="btn btn--danger" onClick={onEnd}>
                End
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;
