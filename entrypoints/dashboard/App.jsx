import { useEffect, useState, useRef } from 'react'
import { getBucketsFromLocal, deleteBucket, openTabs, renameBucketName, createReloadDashboard, toggleBucketLock, openTabGroup } from '../../services/index.js';
import useOutsideClick from '../../assets/hooks/useOusideClick.js';
import { FaLock, FaLockOpen } from "react-icons/fa6";

function App() {
  const [buckets, setBuckets] = useState([]);
  const [bucketInput, setBucketInput] = useState('');
  const [activeInput, setActiveInput] = useState('');
  const inputContainerRef = useRef(null);

  useOutsideClick(inputContainerRef, (e) => {
    setBucketInput('');
    setActiveInput('');
  });

  useEffect(() => {
    getBuckets();
  }, []);

  function onOpenTabsHandler(tabs) {
    openTabs(tabs);
  }

  function onOpenAsGroupTabsHandler(bucket) {
    openTabGroup(bucket);
  }

  async function getBuckets() {
    let buckets = await getBucketsFromLocal();
    setBuckets(buckets);
  }

  async function deleteBucketHandler(id) {
    await deleteBucket(id);
    getBuckets();
  }

  function onBucketNameSubmit(id) {
    renameBucketName(id, bucketInput);
    setActiveInput('');
    createReloadDashboard();
  }

  function bucketLockHandler(id) {
    toggleBucketLock(id)
    createReloadDashboard();
  }

  return (
    <div className='p-4 flex flex-col gap-4 text-base'>
      <h1 className='font-bold text-2xl'>Tarchive</h1>
      {
        (buckets.length === 0) && <p className='text-xl'>You have no buckets, yet!</p>
      }
      {
        buckets.map((bucket) => {
          return <div key={bucket.id} className='flex flex-col gap-2'>
            <div className='flex flex-row items-center gap-6'>
              {!(activeInput === bucket.id) && <p onClick={() => setActiveInput(bucket.id)} className='font-bold'>{bucket.name}</p>}
              {(activeInput === bucket.id) && <div ref={inputContainerRef} className='w-[220px] flex gap-1'>
                <input className='w-full px-4 py-[3px] border-[1px] border-black rounded-full' type="text" name="bucketName" id="bucket_name" value={bucketInput === "" ? bucket.name : bucketInput} onChange={(e) => setBucketInput(e.target.value)} />
                <button className='px-3 border-[1px] border-black rounded-full' onClick={(e) => onBucketNameSubmit(bucket.id)}>save</button>
              </div>
              }
              <div className='flex gap-2'>
                <button className='cursor-pointer p-2 bg-slate-200 rounded-full' onClick={(e) => bucketLockHandler(bucket.id)}>
                  {bucket.isLocked ? <FaLock /> : <FaLockOpen />}
                </button>
                <button className='bg-slate-200 rounded-full py-1 px-4 cursor-pointer' onClick={() => onOpenTabsHandler(bucket.tabs)}>open</button>
                <button className='bg-slate-200 rounded-full py-1 px-4 cursor-pointer' onClick={() => onOpenAsGroupTabsHandler(bucket)}>open as group</button>
                <button className='bg-red-200 rounded-full py-1 px-4 cursor-pointer' onClick={() => deleteBucketHandler(bucket.id)}>delete</button>
              </div>
            </div>
            <div className='flex flex-col gap-1'>
              {
                bucket.tabs.map(({ id, url, title, favIconUrl }) => {
                  return <a className='w-fit underline cursor-pointer flex items-center gap-2' target='_blank' key={id} href={url}>
                    <img src={favIconUrl} width={20} height={20} className='' />
                    <p>{title}</p>
                  </a>
                })
              }
            </div>
          </div>
        })
      }
    </div >
  );
}
export default App;