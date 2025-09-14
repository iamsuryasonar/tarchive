import React, { useEffect, useState } from "react";
import { getAllWorkspaces } from "../../../db";

export const BucketContext = React.createContext(null);

export function BucketProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState({});

  async function getWorkspaces() {
    setLoading(true);
    let res = await getAllWorkspaces();
    setWorkspaces(res);
    setLoading(false);
  }

  useEffect(() => {
    getWorkspaces();
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel("tarchive_channel");
    channel.onmessage = (event) => {
      if (event.data.type === "session_updated") {
        getSession();
      }
    };
  }, []);

  return (
    <BucketContext.Provider value={{ loading, workspaces, getWorkspaces }}>
      {children}
    </BucketContext.Provider>
  );
}
