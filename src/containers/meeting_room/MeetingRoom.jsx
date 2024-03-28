import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import io from "socket.io-client";
import { SOCKET_EVENTS } from "../../utils/constants";
import styles from "./MeetingRoom.module.css";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaUserCircle,
} from "react-icons/fa";
import { MdScreenShare, MdStopScreenShare, MdCallEnd } from "react-icons/md";

let peer = null;

function MeetingRoom() {
  const { meetId } = useParams();

  const navigate = useNavigate();

  const [isUserMute, setIsUserMute] = useState(false);
  const [isUserVideoHide, setIsUserVideoHide] = useState(false);
  const [isPartnerMute, setIsPartnerMute] = useState(false);
  const [isPartnerVideoHide, setIsPartnerVideoHide] = useState(false);
  const [isScreenShared, setIsScreenShared] = useState(false);
  const [showOtherUser, setShowOtherUser] = useState(false);

  const socketRef = useRef();
  const otherUser = useRef();
  const peerRef = useRef();
  const userStream = useRef();
  const userVideoStream = useRef();
  const partnerVideoStream = useRef();

  const handleNegotiationNeededEvent = (userID) => {
    peerRef.current
      ?.createOffer()
      ?.then((offer) => {
        return peerRef.current.setLocalDescription(offer);
      })
      .then(() => {
        const payload = {
          target: userID,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription,
        };
        socketRef.current.emit(SOCKET_EVENTS.OFFER, payload);
      })
      .catch((e) => console.log(e));
  };

  const handleICECandidateEvent = (e) => {
    if (e.candidate) {
      const payload = {
        target: otherUser.current,
        candidate: e.candidate,
      };
      socketRef.current.emit(SOCKET_EVENTS.ICE_CANDIDATE, payload);
    }
  };

  function handleTrackEvent(e) {
    partnerVideoStream.current.srcObject = e.streams[0];
  }

  const createPeer = (userID) => {
    peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
        {
          urls: "turn:numb.viagenie.ca",
          credential: "muazkh",
          username: "webrtc@live.com",
        },
      ],
    });

    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

    return peer;
  };

  const callUser = (userID) => {
    peerRef.current = createPeer(userID);
    userStream.current
      ?.getTracks()
      ?.forEach((track) => peerRef.current.addTrack(track, userStream.current));
  };

  const handleRecieveCall = (incoming) => {
    peerRef.current = createPeer();
    const desc = new RTCSessionDescription(incoming.sdp);
    peerRef.current
      ?.setRemoteDescription(desc)
      ?.then(() => {
        userStream.current
          .getTracks()
          .forEach((track) =>
            peerRef.current.addTrack(track, userStream.current)
          );
      })
      .then(() => {
        return peerRef.current.createAnswer();
      })
      .then((answer) => {
        return peerRef.current.setLocalDescription(answer);
      })
      .then(() => {
        const payload = {
          target: incoming.caller,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription,
        };
        socketRef.current.emit(SOCKET_EVENTS.ANSWER, payload);
      });
  };

  const handleAnswer = (message) => {
    const desc = new RTCSessionDescription(message.sdp);
    peerRef.current?.setRemoteDescription(desc)?.catch((e) => console.log(e));
  };

  const handleNewICECandidateMsg = (incoming) => {
    const candidate = new RTCIceCandidate(incoming);

    peerRef.current?.addIceCandidate(candidate).catch((e) => console.log(e));
  };

  const getInitialSocketUtils = () => {
    socketRef.current.emit(SOCKET_EVENTS.JOIN_ROOM, meetId);

    socketRef.current.on(SOCKET_EVENTS.OTHER_USER, (userID) => {
      callUser(userID);
      console.log("other user", userID);
      otherUser.current = userID;
      setShowOtherUser(true);
    });

    socketRef.current.on(SOCKET_EVENTS.USER_JOINED, (userID) => {
      console.log("user joined", userID);
      otherUser.current = userID;
      setShowOtherUser(true);
    });

    socketRef.current.on(SOCKET_EVENTS.OFFER, handleRecieveCall);

    socketRef.current.on(SOCKET_EVENTS.ANSWER, handleAnswer);

    socketRef.current.on(SOCKET_EVENTS.ICE_CANDIDATE, handleNewICECandidateMsg);

    socketRef.current.on(SOCKET_EVENTS.TOGGLE_MIC, (micStatus) => {
      setIsPartnerMute(micStatus);
    });

    socketRef.current.on(SOCKET_EVENTS.TOGGLE_VIDEO, (videoStatus) => {
      setIsPartnerVideoHide(videoStatus);
    });

    socketRef.current.on(SOCKET_EVENTS.USER_LEAVE, () => {
      peerRef.current = null;
      otherUser.current = null;
      partnerVideoStream.current.srcObject = null;
      setShowOtherUser(false);
    });
  };

  const toggleMyMic = (isMuted) => {
    const payload = {
      target: otherUser.current,
      micStatus: isMuted,
    };

    if (userStream.current && peerRef.current) {
      let audTrack = userStream.current?.getAudioTracks()?.[0];
      const sender = peerRef.current
        ?.getSenders?.()
        ?.find((s) => s.track.kind === audTrack.kind);

      if (isMuted) {
        audTrack.enabled = false;
      } else {
        audTrack.enabled = true;
      }

      sender.replaceTrack(audTrack);
    }

    setIsUserMute(isMuted);
    socketRef.current.emit(SOCKET_EVENTS.TOGGLE_MIC, payload);
  };

  const toggleMyVideo = (isHidden) => {
    const payload = {
      target: otherUser.current,
      videoStatus: isHidden,
    };

    if (userStream.current) {
      if (isHidden) {
        let vidTrack = userStream.current?.getVideoTracks()?.[0];

        if (peerRef.current) {
          peerRef.current?.getSenders?.()?.find((s) => {
            if (s.track?.kind === vidTrack?.kind) {
              s.track?.stop?.();
              return true;
            }
            return false;
          });
        }

        userStream.current?.getTracks?.()?.find((track) => {
          if (track?.kind === vidTrack?.kind) {
            track?.stop?.();
            return true;
          }
          return false;
        });

        userStream.current.getVideoTracks()[0].enabled = !isHidden;
        socketRef.current.emit(SOCKET_EVENTS.TOGGLE_VIDEO, payload);
      } else {
        navigator.mediaDevices
          .getUserMedia({ video: true })
          .then((stream) => {
            let vidTrack = stream?.getVideoTracks()[0];

            const host = userStream.current
              ?.getTracks?.()
              ?.find((track) => track?.kind === vidTrack?.kind);

            if (peerRef.current) {
              const sender = peerRef.current
                ?.getSenders?.()
                ?.find((s) => s.track?.kind === vidTrack?.kind);

              sender.replaceTrack(vidTrack);
            }

            userStream.current?.removeTrack(host);
            userStream.current?.addTrack(vidTrack);
            socketRef.current.emit(SOCKET_EVENTS.TOGGLE_VIDEO, payload);
          })
          .catch((error) => {
            console.log("error: ", error);
          });
      }
    }

    setIsUserVideoHide(isHidden);
  };

  useEffect(() => {
    console.log("meetIdHere-->", meetId, process.env.REACT_APP_SOCKET_URL);

    if (socketRef?.current) return;

    socketRef.current = io.connect(process.env.REACT_APP_SOCKET_URL);

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        console.log("stream: ", stream);
        userStream.current = stream;
        userVideoStream.current.srcObject = stream;
        getInitialSocketUtils();
      })
      .catch((error) => {
        console.log("error: ", error);
        userStream.current = null;
        getInitialSocketUtils();
      });
  }, []);

  const handleShareScreen = async () => {
    if (peerRef.current) {
      navigator.mediaDevices
        .getDisplayMedia({
          video: {
            cursor: "always",
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        })
        .then((stream) => {
          const displayMediaStream = stream?.getVideoTracks()?.[0];
          const sender = peerRef.current
            .getSenders()
            .find((s) => s.track.kind === displayMediaStream.kind);
          sender.replaceTrack(displayMediaStream);
          userVideoStream.current.srcObject = stream;
          setIsScreenShared(true);

          const payload = {
            target: otherUser.current,
            videoStatus: false,
          };

          socketRef.current.emit(SOCKET_EVENTS.TOGGLE_VIDEO, payload);
          setIsUserVideoHide(false);
        })
        .catch((err) => console.log(err));
    } else {
      alert("No user found to share the screen");
    }
  };

  const stopScreenShare = () => {
    const videoTrack = userStream.current?.getVideoTracks()?.[0];
    const sender = peerRef.current
      ?.getSenders?.()
      .find((s) => s.track.kind === videoTrack.kind);
    sender.replaceTrack(videoTrack);
    userVideoStream.current.srcObject = userStream.current;
    setIsScreenShared(false);

    const payload = {
      target: otherUser.current,
      videoStatus: true,
    };

    socketRef.current.emit(SOCKET_EVENTS.TOGGLE_VIDEO, payload);
    setIsUserVideoHide(true);
  };

  const handleEndCall = () => {
    userStream.current?.getTracks()?.forEach((track) => {
      track.stop();
    });
    socketRef.current.emit(SOCKET_EVENTS.USER_LEAVE);
    socketRef.current.disconnect();
    navigate("/");
  };

  return (
    <div className={styles.MainContainer}>
      <div className={styles.VideoOuterContainer}>
        <div
          className={
            showOtherUser
              ? styles.UserVideoContainer
              : styles.PartnerVideoContainer
          }
        >
          {isUserVideoHide && (
            <div className={styles.NoVideoTag}>
              <FaUserCircle color="white" size={100} />
            </div>
          )}
          <video
            autoPlay
            muted
            ref={userVideoStream}
            className={styles.VideoTag}
          />
        </div>
        {showOtherUser && (
          <div className={styles.PartnerVideoContainer}>
            {isPartnerVideoHide && (
              <div className={styles.NoVideoTag}>
                <FaUserCircle color="white" size={100} />
              </div>
            )}
            <video
              autoPlay
              ref={partnerVideoStream}
              className={styles.VideoTag}
            />
          </div>
        )}
      </div>

      <div className={styles.ActionButtonsContainer}>
        {isUserVideoHide ? (
          <button
            className={styles.ActionButtons}
            onClick={() => toggleMyVideo(!isUserVideoHide)}
          >
            <FaVideoSlash />
          </button>
        ) : (
          <button
            className={styles.ActionButtons}
            onClick={() => toggleMyVideo(!isUserVideoHide)}
          >
            <FaVideo />
          </button>
        )}
        {isUserMute ? (
          <button
            className={styles.ActionButtons}
            onClick={() => toggleMyMic(!isUserMute)}
          >
            <FaMicrophoneSlash />
          </button>
        ) : (
          <button
            className={styles.ActionButtons}
            onClick={() => toggleMyMic(!isUserMute)}
          >
            <FaMicrophone />
          </button>
        )}
        {isScreenShared ? (
          <button className={styles.ActionButtons} onClick={stopScreenShare}>
            <MdStopScreenShare />
          </button>
        ) : (
          <button className={styles.ActionButtons} onClick={handleShareScreen}>
            <MdScreenShare />
          </button>
        )}
        <button className={styles.ActionButtons} onClick={handleEndCall}>
          <MdCallEnd />
        </button>
      </div>
    </div>
  );
}

export default MeetingRoom;
