"use client";

import { fetchAndPlayTextToSpeech } from "@/app/actions";
import { useEffect, useRef, useState } from "react";

// Remove all " and ' when passing to eleven labs.
function addslashes(str: string) {
  return (str + "").replaceAll('"', "").replaceAll("'", "");
}

// Play audio from post response from 11 labs
async function pAudio(url: string) {
  var audio = new Audio(url);
  audio.play();
}

function isEmpty(val: string | undefined | null) {
  return val === undefined || val == null || val.length <= 0 ? true : false;
}

export default function Page({
  searchParams,
}: {
  searchParams: {
    name: string;
  };
}) {
  const videoUrl: string = `https://${process.env.NEXT_PUBLIC_BUCKET_NAME}.fly.storage.tigris.dev/${searchParams.name}`;
  const [narration, setNarration] = useState("");
  const [eachNar, setEachNar] = useState("");
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (narration !== "") {
        const response = await fetchAndPlayTextToSpeech(narration);
        if (response) {
          pAudio(response);
        }
      }
    };

    if (narration !== "") {
      let incre = 0;
      const timeoutId = setInterval(() => {
        setEachNar(narration);
        incre++;
        if (incre >= narration.length) {
          clearTimeout(timeoutId);
        }
      }, 1000);
      fetchData();

      return () => clearTimeout(timeoutId);
    }
  }, [narration]);

  const vidRef = useRef<HTMLVideoElement>(null);
  const canRef = useRef<HTMLCanvasElement>(null);

  const handlePlayVideo = () => {
    if (vidRef.current != null) {
      vidRef.current.play();
    }
  };

  let eventSource: any = null;

  async function describeVideo() {
    setShowSpinner(true);
    const queryParams = new URLSearchParams({
      url: videoUrl,
      key: searchParams.name,
    }).toString();
    if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
      console.log("event source does not exist. Creating...");
      eventSource = new EventSource("/api/describeVideo?" + queryParams);
      console.log("ready state: ", eventSource.readyState);

      eventSource.addEventListener("message", (event: any) => {
        const tmp = JSON.parse(event.data);
        setShowSpinner(false);
        setNarration(narration + " " + tmp.message);
        console.log("event message", tmp.message);
      });

      eventSource.addEventListener("error", (e: Error) => {
        console.log("event error", e);
        eventSource.close();
      });
      // As soon as SSE API source is closed, attempt to reconnect
      eventSource.addEventListener("close", () => {
        console.log("event close");
      });
    } else {
      console.log("event source already exists");
    }

    // await fetch(`/api/describeVideo/`, {
    //   method: "POST",
    //   body: JSON.stringify({
    //     url: videoUrl,
    //     key: searchParams.name,
    //   }),
    // }).then(async (response) => {
    //   setShowSpinner(false);
    //   console.log(response);
    //   const restext: string[] = JSON.parse(await response.text());
    //   const restextStr = restext.join("");
    //   setNarration(restextStr);
    // });
    //return () => eventSource.close();
  }

  function calculateCaptureTimes(
    currentTime: number,
    interval: number,
    countBefore: number, // # of frames before current time
    countAfter: number // # of frames after current time
  ): number[] {
    const times = [];
    if (currentTime < interval) {
      // reset interval to be a reasonable slice if currentTime is too small
      interval = currentTime / Math.ceil(countBefore + countAfter + 1);
    }

    const startTime = Math.max(currentTime - countBefore * interval, 0); // start time should not be negative

    for (let i = 0; i < countBefore + countAfter + 1; i++) {
      const time = startTime + i * interval;
      if (time >= currentTime - countBefore * interval) {
        times.push(time);
      }
    }

    return times;
  }

  async function captureFrame() {
    if (canRef.current && vidRef.current) {
      vidRef.current.pause();
      const context = canRef.current.getContext("2d")!;
      const currentTime = vidRef.current.currentTime;
      const captureTimes = calculateCaptureTimes(currentTime, 5, 5, 0);
      console.log("captureTimes", captureTimes);
      let dataURLs: string[] = [];
      for (const time of captureTimes) {
        vidRef.current.currentTime = time;
        await new Promise((resolve) => setTimeout(resolve, 300));
        context.drawImage(vidRef.current, 0, 0, 640, 400);
        const dataURL = canRef.current.toDataURL("image/jpeg", 1);
        dataURLs.push(dataURL);
      }

      setShowSpinner(true);
      fetch(`/api/describe/`, {
        method: "POST",
        body: JSON.stringify({
          frames: dataURLs,
        }),
      }).then(async (response) => {
        setShowSpinner(false);
        vidRef.current!.play();
        const restext = await response.text();
        setNarration(restext);
      });
    }
  }

  return (
    <>
      <div className="playerContainer">
        <h3>Playing video from Tigris:</h3>
        <p>{videoUrl}</p>

        <video
          ref={vidRef}
          crossOrigin=""
          width="640"
          height="400"
          controls
          preload="auto"
          data-setup="{}"
        >
          <source src={videoUrl} type="video/mp4" />
        </video>

        <div>
          <button
            className="button-53"
            onClick={handlePlayVideo}
            style={{ marginRight: 20 }}
          >
            Play
          </button>
          <button style={{ marginRight: 20 }} onClick={captureFrame}>
            Capture
          </button>
          <button onClick={describeVideo}>Describe Video</button>
        </div>

        <h3>Narration using GPT 4 vision:</h3>
        <p>{eachNar}</p>

        {showSpinner && (
          <div className="lds-ellipsis">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        )}

        <canvas
          ref={canRef}
          width="640"
          height="480"
          style={{ display: "none" }}
        ></canvas>
      </div>
    </>
  );
}
