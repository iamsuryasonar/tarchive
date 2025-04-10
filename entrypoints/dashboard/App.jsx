import { useEffect, useState } from 'react';
import { BucketContext } from './context/context.jsx';
import Dashboard from './Dashboard.jsx';
import { getBucketsFromLocal } from '../../services/index.js';

function App() {
  const [buckets, setBuckets] = useState([]);

  useEffect(() => {
    getBuckets();
  }, [])

  async function getBuckets() {
    let result = await getBucketsFromLocal();
    setBuckets(result);
  }

  return (
    <>
      <BucketContext.Provider value={{ buckets, getBuckets }}>
        <Dashboard />
      </BucketContext.Provider>
    </>
  );
}
export default App;