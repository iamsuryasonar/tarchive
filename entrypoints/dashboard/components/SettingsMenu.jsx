import { useState, useEffect } from 'react'
import { getIsAllowDuplicateTab, updateIsAllowDuplicateTab } from '../../../db';
import { useRef } from 'react';
import { IoMdClose } from 'react-icons/io';

function SettingsMenu({ isOpen, setIsOpen }) {

    const settingsMenuRef = useRef();

    const [isAllowDuplicateTab, setIsAllowDuplicateTab] = useState(false);

    useOutsideClick(settingsMenuRef, (e) => {
        setIsOpen(false);
    });

    useEffect(() => {
        (async () => {
            let res = await getIsAllowDuplicateTab();
            setIsAllowDuplicateTab(res);
        })()
    }, [])

    async function onCheckIsDuplicateTab(e) {
        await updateIsAllowDuplicateTab(e.target.checked);
        let res = await getIsAllowDuplicateTab();
        setIsAllowDuplicateTab(res);
    }

    console.log(isAllowDuplicateTab)

    return <>
        {
            isOpen && <div ref={settingsMenuRef} className='absolute z-20 top-full right-4 w-fit p-4 flex flex-col gap-2 bg-[#262832] rounded-lg shadow-md border-1 border-black/20'>
                <div className='pb-1 flex justify-end border-b-2 border-white/10'>
                    <button onClick={() => setIsOpen(false)} className='cursor-pointer text-[#c9c9c9] hover:text-white'><IoMdClose size={26} /></button>
                </div>
                <label htmlFor="isAllow" className='flex gap-2 cursor-pointer'>
                    <input className='cursor-pointer' type="checkbox" name="" id="isAllow" onChange={onCheckIsDuplicateTab} checked={isAllowDuplicateTab ? true : false} />
                    <span>Allow duplicate tab in a bucket</span>
                </label>
            </div>
        }
    </>
}

export default SettingsMenu