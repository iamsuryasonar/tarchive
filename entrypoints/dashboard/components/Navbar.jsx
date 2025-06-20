import { useState } from "react";
import { MdSettings } from "react-icons/md";
import SettingsMenu from "./SettingsMenu";

function Navbar() {
    const [isSettingMenuOpen, setIsSettingMenuOpen] = useState(false);


    return (
        <nav className='w-full sticky z-20 top-0 left-0 right-0 h-[60px] px-6 flex justify-between items-center bg-[#222222]'>
            <h1 className='font-bold text-2xl'>Tarchive</h1>
            <div className='flex justify-between gap-4'>
                {/* <input className='px-2 border-1 border-white rounded-full' type="text" placeholder='Search' /> */}
                <div></div>
                <button onClick={() => setIsSettingMenuOpen(true)} className={`${isSettingMenuOpen ? 'text-[#87bafd]' : 'text-[#c9c9c9]'} hover:text-white disabled:hover:text-[#87bafd] cursor-pointer`} disabled={isSettingMenuOpen ? true : false}> <MdSettings size={26} /></button>
            </div>
            <SettingsMenu isOpen={isSettingMenuOpen} setIsOpen={setIsSettingMenuOpen} />
        </nav >
    )
}

export default Navbar