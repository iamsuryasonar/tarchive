import { useState, useEffect } from 'react'
import { importAllDataFromJSON, exportAllDataAsJson, getIsAllowDuplicateTab, getIsAllowPinnedTab, updateIsAllowDuplicateTab, updateIsAllowPinnedTab } from '../../../db';
import { useRef } from 'react';
import { IoMdClose } from 'react-icons/io';
import { browser } from 'wxt/browser';

function SettingsMenu({ isOpen, setIsOpen }) {

    const settingsMenuRef = useRef();
    const fileInputRef = useRef(null);
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

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            await importAllDataFromJSON(file);

            const channel = new BroadcastChannel("tarchive_channel");
            channel.postMessage({ type: "workspaces_updated" });

            alert('Import successful!');
        } catch (error) {
            console.error('Import failed:', error);
            alert('Import failed.');
        }
    };

    function handleUpdateShortcut() {
        browser.tabs.create({ url: "chrome://extensions/shortcuts" });
    }

    return <>
        {
            isOpen && <div ref={settingsMenuRef} className='absolute z-20 top-full right-4 w-fit p-4 flex flex-col gap-4 bg-[#262832] rounded-lg shadow-md border-1 border-black/20'>
                <div className='pb-1 flex justify-between border-b-2 border-white/10'>
                    <p className='font-bold'>Settings</p>
                    <button onClick={() => setIsOpen(false)} className='cursor-pointer text-[#c9c9c9] hover:text-white'><IoMdClose size={26} /></button>
                </div>
                <div className='flex flex-col gap-2'>
                    <label htmlFor="isAllowDuplicate" className='flex gap-2 cursor-pointer'>
                        <input className='cursor-pointer' type="checkbox" name="" id="isAllowDuplicate" onChange={onCheckIsDuplicateTab} checked={isAllowDuplicateTab ? true : false} />
                        <span>Allow duplicate tab in a bucket</span>
                    </label>
                    <label htmlFor="isAllowPinned" className='flex gap-2 cursor-pointer'>
                        <input className='cursor-pointer' type="checkbox" name="" id="isAllowPinned" onChange={onCheckIsPinnedTab} checked={isAllowPinnedTab ? true : false} />
                        <span>Allow pinned tab in a bucket</span>
                    </label>
                </div>
                <button className='place-self-start hover:underline cursor-pointer' onClick={handleUpdateShortcut}>Update shortcuts</button>
                <div className='flex flex-col gap-2'>
                    <button className='text-[#c9c9c9] hover:text-white cursor-pointer border-1 px-4 py-1 rounded-full' onClick={() => exportAllDataAsJson()}>Export</button>
                    <button className='text-[#c9c9c9] hover:text-white cursor-pointer border-1 px-4 py-1 rounded-full' onClick={handleButtonClick}>Import</button>
                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                </div>
            </div >
        }
    </>
}

export default SettingsMenu