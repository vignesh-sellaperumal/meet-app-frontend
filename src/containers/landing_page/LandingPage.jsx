import React from "react";
import styles from "./LandingPage.module.css";
import logo from "../../assets/logo.jpg";
import twoPerson from "../../assets/two-person.png";
import { useNavigate } from "react-router";

function LandingPage() {
  const navigate = useNavigate();

  const generateMeetingID = (length) => {
    const characters = "abcdefghijklmnopqrstuvwxyz";
    let meetingID = "";

    for (let i = 0; i < length; i++) {
      if (i === 3 || i === 9) {
        meetingID += "-";
      } else {
        const randomIndex = Math.floor(Math.random() * characters.length);
        meetingID += characters.charAt(randomIndex);
      }
    }

    return meetingID;
  };

  const handleJoinRoom = () => {
    const generatedMeetingID = generateMeetingID(13);
    navigate(`/${generatedMeetingID}`);
  };

  const headerContainer = (
    <div className={styles.HeaderContainer}>
      <img src={logo} alt="app-logo" className={styles.LogoContainer} />
    </div>
  );
  const leftContainer = (
    <div className={styles.LeftContainer}>
      <img src={twoPerson} alt="app-logo" className={styles.TwoPersonImage} />
    </div>
  );
  const rightContainer = (
    <div className={styles.RightContainer}>
      <button className={styles.JoinNowButton} onClick={handleJoinRoom}>
        Create a Meeting
      </button>
    </div>
  );

  return (
    <div>
      {headerContainer}
      <div className={styles.BodyContainer}>
        {leftContainer}
        {rightContainer}
      </div>
    </div>
  );
}

export default LandingPage;
