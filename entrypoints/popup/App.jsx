import { useEffect, useState } from 'react'
import { addTabsToBucket, createReloadDashboard, getOpenedTabs, openDashboard } from '../../services/index.js';

function App() {

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
    let filteredTabs = tabs.filter((tab) => {
      if (tab.checked !== false && tab.title !== "about:blank") return tab;
    });

    await addTabsToBucket(filteredTabs);
    createReloadDashboard();
  }

  async function openDashboardHandler() {
    await openDashboard();
  }

  return <div className='w-[300px] max-h-[600px] p-2 flex flex-col gap-2 text-base'>
    <div className='flex items-center justify-between gap-2'>
      <div className='flex items-center gap-2'>
        <input
          type="checkbox"
          name="select all"
          id="select_all"
          onChange={onAllSelectHandler}
          checked={selectAllInput}
        />
        <label htmlFor="select_all">Select all</label>
      </div>
      <div className='flex gap-2'>
        <button className='bg-green-200 rounded-full py-1 px-4 cursor-pointer' onClick={addTabsToBucketHandler}>add</button>
        <button className='bg-green-200 rounded-full py-1 px-4 cursor-pointer' onClick={openDashboardHandler}>view</button>
      </div>
    </div>
    <ul className='flex flex-col gap-1'>
      {
        tabs.map((tab) => {
          return <div key={tab.id} className='flex items-center gap-2'>
            <input type="checkbox" onChange={(e) => onTabSelectHandler(e, tab.id)} checked={tab.checked} />
            <a className='cursor-pointer underline truncate' key={tab.id} href={tab.url}>{tab.title}</a>
          </div>
        })
      }
    </ul>
  </div>
}
export default App;