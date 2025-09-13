import { defaultWorkspaces } from "../../../utils/constants";
import { MdOutlineHistory } from "react-icons/md";
import { IoMdHeartEmpty } from "react-icons/io";

function SideBar({ tag, setTag, setIsAddWorkspaceMenuOpen }) {
  return (
    <aside className="min-w-[200px] w-[350px] h-[calc(100%-60px)] sticky top-[60px] flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="py-1 border-b-[2px] border-white/10 font-bold">
          Workspaces
        </h2>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setTag(defaultWorkspaces.ALL)}
            className={`${
              tag === defaultWorkspaces.ALL ? "bg-[#393d58]" : "bg-[#262831]"
            } w-full py-1  hover:bg-[#28303d] rounded-full cursor-pointer`}
          >
            {defaultWorkspaces.ALL}
          </button>
          <button
            onClick={() => setTag(defaultWorkspaces.FAVORITE)}
            className={`${
              tag === defaultWorkspaces.FAVORITE
                ? "bg-[#393d58]"
                : "bg-[#262831]"
            } w-full py-1  hover:bg-[#28303d] rounded-full cursor-pointer flex items-center justify-center gap-2`}
          >
            <IoMdHeartEmpty />
            {defaultWorkspaces.FAVORITE}
          </button>
          <button
            onClick={() => setTag(defaultWorkspaces.LAST_SESSION)}
            className={`${
              tag === defaultWorkspaces.LAST_SESSION
                ? "bg-[#393d58]"
                : "bg-[#262831]"
            } w-full py-1  hover:bg-[#28303d] rounded-full cursor-pointer flex items-center justify-center gap-2`}
          >
            <MdOutlineHistory />
            {defaultWorkspaces.LAST_SESSION}
          </button>
          {/* <button onClick={() => setIsAddWorkspaceMenuOpen(true)} className='w-full py-1 bg-[#262831] hover:bg-[#364155] rounded-full cursor-pointer flex items-center justify-center gap-2'><FaPlus /> Add</button> */}
        </div>
      </div>
    </aside>
  );
}

export default SideBar;
