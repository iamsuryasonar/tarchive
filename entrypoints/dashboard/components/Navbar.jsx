import { useState } from "react";
import { MdSettings } from "react-icons/md";
import SettingsMenu from "./SettingsMenu";
import { addTabsToBucket } from "../../../db";
import { getOpenedTabs } from "../../../services";

function Navbar() {
  const [isSettingMenuOpen, setIsSettingMenuOpen] = useState(false);

  async function addTabsToBucketHandler() {
    let res = await getOpenedTabs();

    let tabs = res.map((tab) => {
      tab.checked = true;
      return tab;
    });

    await addTabsToBucket(tabs);

    const channel = new BroadcastChannel("tarchive_channel");
    channel.postMessage({ type: "workspaces_updated" });
  }

  return (
    <nav className="w-full sticky z-20 top-0 left-0 right-0 h-[60px] px-6 flex justify-between items-center bg-[#222222]">
      <h1 className="font-bold text-2xl">Tarchive</h1>
      <div className="flex justify-between gap-4">
        <button
          onClick={() => addTabsToBucketHandler()}
          className={`text-[#c9c9c9] hover:text-white cursor-pointer border-1 px-4 py-1 rounded-full`}
        >
          {" "}
          Add tabs to bucket
        </button>
        <button
          onClick={() => setIsSettingMenuOpen(true)}
          className={`${
            isSettingMenuOpen ? "text-[#87bafd]" : "text-[#c9c9c9]"
          } hover:text-white disabled:hover:text-[#87bafd] cursor-pointer`}
          disabled={isSettingMenuOpen}
        >
          {" "}
          <MdSettings size={26} />
        </button>
      </div>
      <SettingsMenu
        isOpen={isSettingMenuOpen}
        setIsOpen={setIsSettingMenuOpen}
      />
    </nav>
  );
}

export default Navbar;
