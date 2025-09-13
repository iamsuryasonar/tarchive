import { useEffect, useState } from 'react'
import { addTabsToBucket } from '../../db';
import { getOpenedTabs, openDashboard, openCurrentTab } from '../../services'
import { IoAddCircleOutline, IoEyeOutline } from 'react-icons/io5';
import { getEmptyPopUpFallBackMessage } from '../../utils/constants';
import TabCard from './components/TabCard';

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
        await addTabsToBucket(tabs);

        const channel = new BroadcastChannel("tarchive_channel");
        channel.postMessage({ type: "workspaces_updated" });

        window.close(); //close popup window
    }

    async function openDashboardHandler() {
        await openDashboard();
        window.close();
    }

    const fallbackMessage = tabs.length === 0 ? getEmptyPopUpFallBackMessage() : '';

    return <div className='w-[400px] max-h-[400px] overflow-y-auto p-3 pl-0 flex flex-col gap-2 text-base bg-[#222222] text-white'>
        <header className='pl-3 flex items-center justify-between gap-2'>
            <div className='flex items-center gap-2'>
                {
                    tabs.length > 1 && <>
                        <input
                            className='accent-blue-200 bg-[#2a2e3b] border border-[#3a3f4f] focus:ring-1 focus:ring-blue-300 rounded cursor-pointer'
                            type="checkbox"
                            name="select all"
                            id="select_all"
                            onChange={onAllSelectHandler}
                            checked={selectAllInput}
                        />
                        <label className="cursor-pointer" htmlFor="select_all">Select all</label>
                    </>
                }
            </div>
            <div className='flex gap-2'>
                <button className='py-1 px-3 flex gap-1 items-center rounded-full cursor-pointer bg-[#2a2e3b] hover:bg-[#364155] text-blue-200' onClick={addTabsToBucketHandler}>
                    <IoAddCircleOutline />
                    <p>add</p>
                </button>
                <button className='py-1 px-3 flex gap-1 items-center rounded-full cursor-pointer bg-[#2a2e3b] hover:bg-[#364155] text-blue-200' onClick={openDashboardHandler}>
                    <IoEyeOutline />
                    <p>view</p>
                </button>
            </div>
        </header>
        <div className='bg-white/[0.1] h-[1px] ml-2'></div>
        {
            tabs.length > 0 ?
                <ul className='flex flex-col gap-2'>
                    {
                        tabs.map((tab) => {
                            return <TabCard
                                key={tab.id}
                                tab={tab}
                                openCurrentTab={openCurrentTab}
                                onTabSelectHandler={onTabSelectHandler}
                            />
                        })
                    }
                </ul>
                :
                <div className='p-2'>
                    <p>{fallbackMessage}</p>
                </div>
        }
    </div >
}
export default PopUp;