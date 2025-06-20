
function TabCard({ tab, openCurrentTab, onTabSelectHandler }) {
    const { id, title, checked, favIconUrl } = tab;

    return (
        <div key={id} className='w-full px-3 py-1 flex items-center gap-2 bg-[#262831] rounded-r-full cursor-pointer group'>
            <input className='px-2 accent-blue-200 bg-[#2a2e3b] border border-[#3a3f4f] focus:ring-1 focus:ring-blue-300 rounded cursor-pointer' type="checkbox" onChange={(e) => onTabSelectHandler(e, id)} checked={checked} />
            <div className='bg-[#6e7386] w-[2px] h-4 rounded-full shrink-0'></div>
            <div className='grid grid-flow-col gap-1' onClick={() => openCurrentTab(id)}>
                <img src={favIconUrl} width={20} height={20} className='' />
                <button className='truncate text-gray-300 group-hover:text-blue-200 cursor-pointer'>{title}</button>
            </div>
        </div>
    )
}

export default TabCard