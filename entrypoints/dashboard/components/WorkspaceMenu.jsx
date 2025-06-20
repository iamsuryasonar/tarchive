import { IoMdClose } from "react-icons/io";

function WorkspaceMenu({ isAddWorkspaceMenuOpen, setIsAddWorkspaceMenuOpen }) {
    const [inputValue, setInputValue] = useState('');

    function handleOnchange(e) {
        setInputValue(e.target.value)
    }

    return <>
        {
            isAddWorkspaceMenuOpen && <div className='z-50 fixed inset-0 bg-[#222222] flex items-center justify-center' >
                <div className='p-4 w-[380px] flex flex-col gap-3 text-white text-base'>
                    <div>
                        <div className='py-4 flex justify-between'>
                            <p>Add Workspace</p>
                            <button onClick={() => { setIsAddWorkspaceMenuOpen(false) }} className='text-white/80 hover:text-white cursor-pointer'>
                                <IoMdClose size={26} />
                            </button>
                        </div>
                        <input id='input' className='w-full px-2 py-1 border-1 border-white' type="text" value={inputValue} onChange={handleOnchange} placeholder='add workspace here...' />
                    </div>
                    <button className='bg-white/90 hover:bg-white text-black px-4 py-1 cursor-pointer'>Save</button>
                </div>
            </div>
        }
    </>
}

export default WorkspaceMenu;