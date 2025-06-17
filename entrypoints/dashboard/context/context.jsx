import React, { useEffect, useState } from 'react'
import { getBucketsFromLocal } from '../../../services';

export const BucketContext = React.createContext(null);

export function BucketProvider({ children }) {
    const [buckets, setBuckets] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getBuckets();
    }, [])

    async function getBuckets() {
        setLoading(true);
        let result = await getBucketsFromLocal();
        setBuckets(result);
        setLoading(false);
    }

    return <BucketContext.Provider value={{ loading, buckets, getBuckets }}>{children}</BucketContext.Provider>
}
