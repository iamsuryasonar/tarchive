import React, { useState, useContext, useRef } from 'react'
import { IoOpenOutline } from "react-icons/io5";
import { CiMenuFries } from "react-icons/ci";
import { openTabs, renameBucketName } from '../../../services/index';
import { BucketContext } from '../context/context';
import useOutsideClick from '../../../hooks/useOutsideClick';
import { IoMdClose } from 'react-icons/io';
import OptionsMenu from './OptionsMenu';

function BucketCard(props) {
    const {
        bucket,
        idOfSelectedBucket,
        setIdOfSelectedBucket,
        currentBucketMenu,
        setCurrentBucketMenu
    } = props;

    const [bucketInput, setBucketInput] = useState('');

    const { getBuckets } = useContext(BucketContext);
    const inputContainerRef = useRef(null);
    const bucketMenuRef = useRef(null);

    useOutsideClick(inputContainerRef, (e) => {
        setBucketInput('');
        setIdOfSelectedBucket('');
    });

    useOutsideClick(bucketMenuRef, (e) => {
        setCurrentBucketMenu('');
    });

    async function onBucketNameSubmit(id) {
        await renameBucketName(id, bucketInput);
        setIdOfSelectedBucket('');
        getBuckets();
    }

    function onOpenTabsHandler(tabs) {
        openTabs(tabs);
    }

    async function onEnterPressed(e, id) {
        if (e.key === "Enter") {
            await renameBucketName(id, bucketInput);
            setIdOfSelectedBucket('');
            getBuckets();
        }
    }

    function toggleBucketMenu(id) {
        if (currentBucketMenu === id) {
            setCurrentBucketMenu('');
        } else {
            setCurrentBucketMenu(id);
        }
    }

    return (
        <div key={bucket.id} className='flex flex-col gap-2 text-white'>
            <div className='relative p-2 pl-4 flex flex-row items-center justify-between gap-6 bg-[#2a2e3b57] rounded-r-full'>
                {
                    !(idOfSelectedBucket === bucket.id) && <p onClick={() => setIdOfSelectedBucket(bucket.id)} className='font-bold text-xl'>{bucket.name}</p>
                }
                {
                    (idOfSelectedBucket === bucket.id) && <div ref={inputContainerRef} className='w-[220px] flex gap-1'>
                        <input
                            id="bucket_name"
                            className='w-full px-4 py-[3px] border-1 border-black rounded-full'
                            type="text"
                            name="bucketName"
                            value={bucketInput === "" ? bucket.name : bucketInput}
                            onChange={(e) => setBucketInput(e.target.value)} onKeyDown={(e) => onEnterPressed(e, bucket.id)} />
                        <button className='px-3 border-[1px] border-black rounded-full cursor-pointer' onClick={(e) => onBucketNameSubmit(bucket.id)}>save</button>
                    </div>
                }
                <div className='flex gap-2'>
                    <button className='bg-[#2a2e3b] hover:bg-[#364155] text-blue-200 rounded-full py-1 px-4 cursor-pointer flex gap-1 items-center'
                        onClick={() => onOpenTabsHandler(bucket.tabs)}>
                        <IoOpenOutline />
                        <p>open</p>
                    </button>
                    {
                        (currentBucketMenu !== bucket.id) ? <button className='py-1 px-4 cursor-pointer flex gap-1 items-center text-blue-200 hover:text-blue-100'
                            onClick={() => toggleBucketMenu(bucket.id)}>
                            <CiMenuFries size={20} />
                        </button> :
                            <button className='py-1 px-4 cursor-pointer flex gap-1 items-center text-blue-200 hover:text-blue-100'
                                onClick={() => setCurrentBucketMenu('')}>
                                <IoMdClose size={20} />
                            </button>
                    }
                </div>
                <OptionsMenu bucket={bucket} currentBucketMenu={currentBucketMenu} />
            </div>
            <div className='flex flex-col gap-2'>
                <div className='px-4 flex flex-col gap-1'>
                    {
                        bucket.tabs.map(({ id, url, title, favIconUrl }) => {
                            return <a className='w-fit hover:underline hover:text-blue-200 cursor-pointer flex items-center gap-2' target='_blank' key={id} href={url}>
                                <img src={favIconUrl} width={20} height={20} className='' />
                                <p>{title}</p>
                            </a>
                        })
                    }
                </div>
            </div>
        </div>
    )
}

export default BucketCard

