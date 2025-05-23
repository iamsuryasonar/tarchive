import { useContext, useState } from 'react';
import { BucketContext } from './context/context.jsx';
import BucketCard from './components/BucketCard';

function Dashboard() {
    const [currentBucketMenu, setCurrentBucketMenu] = useState('');
    const [idOfSelectedBucket, setIdOfSelectedBucket] = useState('');
    const { buckets } = useContext(BucketContext);

    return (
        <div className='pr-4 py-6 flex flex-col items-start gap-4 text-base bg-[#222222] text-white'>
            <h1 className='px-4 font-bold text-2xl'>Tarchive</h1>
            {
                (buckets.length === 0) && <p className='px-4 text-xl'>You have no buckets, yet!</p>
            }
            <div className="max-w-[600px] w-full h-auto flex flex-col gap-4">
                {
                    buckets.map((bucket) => {
                        return <BucketCard
                            key={bucket.id}
                            bucket={bucket}
                            idOfSelectedBucket={idOfSelectedBucket}
                            setIdOfSelectedBucket={setIdOfSelectedBucket}
                            currentBucketMenu={currentBucketMenu}
                            setCurrentBucketMenu={setCurrentBucketMenu}
                        />
                    })
                }
            </div>
        </div >
    );
}
export default Dashboard;