import React, { useContext, useRef } from 'react'
import { FaLock, FaLockOpen, FaTrash } from "react-icons/fa6";
import { IoOpen } from "react-icons/io5";
import { deleteBucket, toggleBucketLock, openTabGroup } from '../../../services/index';
import { BucketContext } from '../context/context';

function OptionsMenu({ bucket, currentBucketMenu }) {
    const bucketMenuRef = useRef(null);
    const { getBuckets } = useContext(BucketContext);

    async function bucketLockHandler(id) {
        await toggleBucketLock(id);
        getBuckets();
    }

    function onOpenAsGroupTabsHandler(bucket) {
        openTabGroup(bucket);
    }

    async function deleteBucketHandler(id) {
        await deleteBucket(id);
        getBuckets();
    }

    return <>
        {
            (currentBucketMenu === bucket.id) && <div ref={bucketMenuRef} className='absolute z-20 top-full right-0 w-fit p-4 mt-2 flex flex-col gap-2 bg-[#2a2e3b57] rounded-lg shadow-lg'>
                <button className='bg-[#2a2e3b] hover:bg-[#364155] text-blue-200 rounded-full py-1 px-4 cursor-pointer flex gap-1 items-center hover:shadow-lg transition-shadow duration-200 ease-in-out' onClick={() => onOpenAsGroupTabsHandler(bucket)}>
                    <IoOpen />
                    <p>open as group</p>
                </button>
                <button className='py-1 px-4 cursor-pointer bg-[#2a2e3b] hover:bg-[#364155] text-blue-200 rounded-full flex gap-1 items-center hover:shadow-lg transition-shadow duration-200 ease-in-out' onClick={(e) => bucketLockHandler(bucket.id)}>
                    {bucket.isLocked ? <FaLockOpen /> : <FaLock />}
                    {bucket.isLocked ? "unlock" : "lock"}
                </button>
                <button className='bg-[#2a2e3b] hover:bg-[#364155] text-blue-200 rounded-full py-1 px-4 cursor-pointer flex gap-1 items-center hover:shadow-lg transition-shadow duration-200 ease-in-out' onClick={() => deleteBucketHandler(bucket.id)}>
                    <FaTrash />
                    <p>delete</p>
                </button>
            </div>
        }
    </>
}

export default OptionsMenu;