import { useState, useContext, useRef } from 'react'
import { IoOpenOutline } from "react-icons/io5";
import { renameBucketName, toggleTag } from '../../../db';
import { openTabs } from '../../../services';
import { BucketContext } from '../context/context';
import useOutsideClick from '../../../hooks/useOutsideClick';
import { IoMdClose } from 'react-icons/io';
import OptionsMenu from './OptionsMenu';
import { CgMenuRightAlt } from 'react-icons/cg';
import { FaHeart, FaRegHeart } from 'react-icons/fa';

function BucketCard(props) {
    const {
        bucket,
        idOfSelectedBucket,
        setIdOfSelectedBucket,
        currentBucketMenu,
        setCurrentBucketMenu
    } = props;

    const [bucketInput, setBucketInput] = useState('');
    const { getWorkspaces } = useContext(BucketContext);
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
        getWorkspaces();
    }

    async function toggleTagHandler(id, tag) {
        await toggleTag(id, tag);
        await getWorkspaces();
    }

    function onOpenTabsHandler(tabs) {
        openTabs(tabs);
    }

    async function onEnterPressed(e, id) {
        if (e.key === "Enter") {
            await renameBucketName(id, bucketInput);
            setIdOfSelectedBucket('');
            getWorkspaces();
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
        <div key={bucket.id} className='h-full flex flex-col gap-2 text-white'>
            <div className='h-[44px] p-1 relative pl-4 flex items-center justify-between gap-6 bg-[#262831] rounded-full'>
                {
                    !(idOfSelectedBucket === bucket.id) && <p onClick={() => setIdOfSelectedBucket(bucket.id)} className='font-bold text-lg'>{bucket.name}</p>
                }
                {
                    (idOfSelectedBucket === bucket.id) && <div ref={inputContainerRef} className='h-full w-[220px] flex items-stretch gap-1'>
                        <input
                            id="bucket_name"
                            className='w-full h-full px-4 border-1 border-white/[0.2] hover:border-white rounded-full'
                            type="text"
                            name="bucketName"
                            value={bucketInput === "" ? bucket.name : bucketInput}
                            onChange={(e) => setBucketInput(e.target.value)} onKeyDown={(e) => onEnterPressed(e, bucket.id)} />
                        <button className='h-full px-3 border-[1px] border-white/[0.2] hover:border-white rounded-full cursor-pointer' onClick={(e) => onBucketNameSubmit(bucket.id)}>save</button>
                    </div>
                }
                <div className='flex gap-2'>
                    <button className='bg-[#2a2e3b] hover:bg-[#364155] text-blue-200 rounded-full py-1 px-4 cursor-pointer flex gap-1 items-center'
                        onClick={() => toggleTagHandler(bucket.id, 'Favorite')}>
                        {
                            bucket?.tag?.includes('Favorite') ? < FaHeart /> : <FaRegHeart />
                        }
                    </button>
                    <button className='bg-[#2a2e3b] hover:bg-[#364155] text-blue-200 rounded-full py-1 px-4 cursor-pointer flex gap-1 items-center'
                        onClick={() => onOpenTabsHandler(bucket.tabs)}>
                        <IoOpenOutline />
                        <p>open</p>
                    </button>
                    {
                        (currentBucketMenu !== bucket.id) ? <button className='py-1 px-4 cursor-pointer flex gap-1 items-center text-blue-200 hover:text-white'
                            onClick={() => toggleBucketMenu(bucket.id)}>
                            <CgMenuRightAlt size={20} />
                        </button> :
                            <button className='py-1 px-4 cursor-pointer flex gap-1 items-center text-blue-200 hover:text-white '
                                onClick={() => setCurrentBucketMenu('')}>
                                <IoMdClose size={20} />
                            </button>
                    }
                </div>
                <OptionsMenu ref={bucketMenuRef} bucket={bucket} currentBucketMenu={currentBucketMenu} />
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

