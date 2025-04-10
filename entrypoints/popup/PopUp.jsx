import { useEffect, useState } from 'react'
import { addTabsToBucket, createReloadDashboard, getOpenedTabs, openDashboard, openCurrentTab } from '../../services/index.js';
import { IoAddCircleOutline } from 'react-icons/io5';
import { FaEye } from 'react-icons/fa';

function PopUp() {

    const [tabs, setTabs] = useState([]);
    const [selectAllInput, setSelectAllInput] = useState(true);

    useEffect(() => {
        (async () => {
            let res = await getOpenedTabs();

            let newTabs = res.map((tab) => {
                tab.checked = true;
                return tab;
            });

            setTabs(newTabs);
        })();
    }, []);

    function onAllSelectHandler(e) {
        let newTabs = tabs.map((tab) => {
            tab.checked = e.target.checked;
            return tab;
        });

        setTabs(newTabs);
        setSelectAllInput(e.target.checked);
    }

    function onTabSelectHandler(e, id) {
        // stopPropagation();
        let count = 0;

        let newTabs = tabs.map((tab) => {
            if (tab.id === id) {
                tab.checked = e.target.checked;
            }
            if (tab.checked) {
                count++;
            }
            return tab;
        });

        setTabs(newTabs);

        // update select all checkbox
        if (count === tabs.length) {
            setSelectAllInput(true);
        } else {
            setSelectAllInput(false);
        }
    }

    async function addTabsToBucketHandler() {
        let filteredTabs = tabs.filter((tab) => {
            if (tab.checked !== false && tab.title !== "about:blank") return tab;
        });

        await addTabsToBucket(filteredTabs);
        window.close();
        createReloadDashboard();
    }

    async function openDashboardHandler() {
        await openDashboard();
        window.close();
    }

    return <div className='w-[400px] max-h-[400px] overflow-y-auto p-3 pl-0 flex flex-col gap-2 text-base bg-[#222222] text-white'>
        <div className='pl-3 flex items-center justify-between gap-2'>
            <div className='flex items-center gap-2'>
                <input
                    className='accent-blue-200 bg-[#2a2e3b] border border-[#3a3f4f] focus:ring-1 focus:ring-blue-300 rounded cursor-pointer'
                    type="checkbox"
                    name="select all"
                    id="select_all"
                    onChange={onAllSelectHandler}
                    checked={selectAllInput}
                />
                <label className="cursor-pointer" htmlFor="select_all">Select all</label>
            </div>
            <div className='flex gap-2'>
                <button className='py-1 px-3 flex gap-1 items-center rounded-full cursor-pointer bg-[#2a2e3b] hover:bg-[#364155] text-blue-200' onClick={addTabsToBucketHandler}>
                    <IoAddCircleOutline />
                    <p>add</p>
                </button>
                <button className='py-1 px-3 flex gap-1 items-center rounded-full cursor-pointer bg-[#2a2e3b] hover:bg-[#364155] text-blue-200' onClick={openDashboardHandler}>
                    <FaEye />
                    <p>view</p>
                </button>
            </div>
        </div>
        <div className='bg-slate-500 h-[1px] ml-2'></div>
        <ul className='flex flex-col gap-2'>
            {
                tabs.map(({ id, title, checked, favIconUrl }) => {
                    return <div key={id} className='w-full px-3 py-1 flex items-center gap-2 bg-[#2a2e3b] rounded-r-full cursor-pointer group'>
                        <input className='px-2 accent-blue-200 bg-[#2a2e3b] border border-[#3a3f4f] focus:ring-1 focus:ring-blue-300 rounded cursor-pointer' type="checkbox" onChange={(e) => onTabSelectHandler(e, id)} checked={checked} />
                        <div className='bg-[#6e7386] w-[2px] h-4 rounded-full shrink-0'></div>
                        <div className='grid grid-flow-col gap-1' onClick={() => openCurrentTab(id)}>
                            <img src={favIconUrl} width={20} height={20} className='' />
                            <button className='truncate text-gray-300 group-hover:text-blue-200 cursor-pointer'>{title}</button>
                        </div>
                    </div>
                })
            }
        </ul>
    </div>
}
export default PopUp;