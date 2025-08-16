import React, { useEffect, useState } from 'react';
import { getAllWorkspaces, getLastSession } from '../../../db';

export const BucketContext = React.createContext(null);

export function BucketProvider({ children }) {
    const [loading, setLoading] = useState(false);
    const [workspaces, setWorkspaces] = useState([]);
    const [lastSession, setLastSession] = useState([]);

    async function getWorkspaces() {
        setLoading(true);
        let res = await getAllWorkspaces();
        setWorkspaces(res)
        setLoading(false);
    }

    async function getSession() {
        setLoading(true);
        let res = await getLastSession();
        setLastSession(res[0]?.tabs)
        setLoading(false);
    }

    useEffect(() => {
        getWorkspaces();
        getSession();
    }, [])

    useEffect(() => {
        const channel = new BroadcastChannel("tarchive_channel");
        channel.onmessage = (event) => {
            if (event.data.type === "session_updated") {
                getSession();
            }
        };
    }, [])


    return <BucketContext.Provider value={{ loading, workspaces, lastSession, getWorkspaces }}>{children}</BucketContext.Provider>
}
