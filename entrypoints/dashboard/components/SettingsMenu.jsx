import { useState, useEffect } from 'react'
import { getIsAllowDuplicateTab, getIsAllowPinnedTab, updateIsAllowDuplicateTab, updateIsAllowPinnedTab } from '../../../db';
import { useRef } from 'react';
import { IoMdClose } from 'react-icons/io';

function SettingsMenu({ isOpen, setIsOpen }) {

    const settingsMenuRef = useRef();

    const [isAllowDuplicateTab, setIsAllowDuplicateTab] = useState(false);
    const [isAllowPinnedTab, setIsAllowPinnedTab] = useState(false);

    useOutsideClick(settingsMenuRef, (e) => {
        setIsOpen(false);
    });

    useEffect(() => {
        (async () => {
            let res = await getIsAllowDuplicateTab();
            setIsAllowDuplicateTab(res);
            let isAllowPinned = await getIsAllowPinnedTab();
            setIsAllowPinnedTab(isAllowPinned)
        })()
    }, [])

    async function onCheckIsDuplicateTab(e) {
        await updateIsAllowDuplicateTab(e.target.checked);
        let res = await getIsAllowDuplicateTab();
        setIsAllowDuplicateTab(res);
    }

    async function onCheckIsPinnedTab(e) {
        await updateIsAllowPinnedTab(e.target.checked);
        let res = await getIsAllowPinnedTab();
        setIsAllowPinnedTab(res);
    }

    return <>
        {
            isOpen && <div ref={settingsMenuRef} className='absolute z-20 top-full right-4 w-fit p-4 flex flex-col gap-2 bg-[#262832] rounded-lg shadow-md border-1 border-black/20'>
                <div className='pb-1 flex justify-end border-b-2 border-white/10'>
                    <button onClick={() => setIsOpen(false)} className='cursor-pointer text-[#c9c9c9] hover:text-white'><IoMdClose size={26} /></button>
                </div>
                <label htmlFor="isAllowDuplicate" className='flex gap-2 cursor-pointer'>
                    <input className='cursor-pointer' type="checkbox" name="" id="isAllowDuplicate" onChange={onCheckIsDuplicateTab} checked={isAllowDuplicateTab ? true : false} />
                    <span>Allow duplicate tab in a bucket</span>
                </label>
                <label htmlFor="isAllowPinned" className='flex gap-2 cursor-pointer'>
                    <input className='cursor-pointer' type="checkbox" name="" id="isAllowPinned" onChange={onCheckIsPinnedTab} checked={isAllowPinnedTab ? true : false} />
                    <span>Allow pinned tab in a bucket</span>
                </label>
            </div >
        }
    </>
}

export default SettingsMenu