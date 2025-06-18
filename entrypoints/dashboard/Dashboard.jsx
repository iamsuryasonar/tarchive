import { useContext, useState } from 'react';
import { BucketContext } from './context/context.jsx';
import BucketCard from './components/BucketCard';
import { FaHeart, FaPlus } from 'react-icons/fa';
import { MdSettings } from 'react-icons/md';
import SettingsMenu from './components/SettingsMenu.jsx';
import { ImSpinner2 } from 'react-icons/im';

function Dashboard() {

    const { loading, workspaces, getWorkspaces } = useContext(BucketContext);

    const [tag, setTag] = useState('All');
    const [isSettingMenuOpen, setIsSettingMenuOpen] = useState(false);

    let newListOfBuckets = workspaces[tag];

    useEffect(() => {
        const channel = new BroadcastChannel("tarchive_channel");

        channel.onmessage = (event) => {
            if (event.data.type === "workspaces_updated") {
                getWorkspaces();
            }
        };

        return () => channel.close();
    }, []);
    console.log(newListOfBuckets)

    return (
        <div className='bg-[#222222]'>
            <div className='min-h-svh max-w-5xl m-auto w-full gap-4 text-base bg-[#222222] text-white'>
                {
                    loading && <div className='absolute top-1/2 left-1/2 -translate-1/2'>
                        <ImSpinner2 size={34} className='animate-spin' />
                    </div>
                }
                <nav className='w-full sticky z-20 top-0 left-0 right-0 h-[60px] px-6 flex justify-between items-center bg-[#222222]'>
                    <h1 className='font-bold text-2xl'>Tarchive</h1>
                    <div className='flex justify-between gap-4'>
                        {/* <input className='px-2 border-1 border-white rounded-full' type="text" placeholder='Search' /> */}
                        <div></div>
                        <button onClick={() => setIsSettingMenuOpen(true)} className={`${isSettingMenuOpen ? 'text-[#87bafd]' : 'text-[#c9c9c9]'} hover:text-white disabled:hover:text-[#87bafd] cursor-pointer`} disabled={isSettingMenuOpen ? true : false}> <MdSettings size={26} /></button>
                    </div>
                    <SettingsMenu isOpen={isSettingMenuOpen} setIsOpen={setIsSettingMenuOpen} />
                </nav >
                <main className='relative flex gap-4 px-6'>
                    <aside className='min-w-[200px] w-[350px] h-[calc(100%-60px)] sticky top-[60px] flex flex-col gap-4'>
                        <div className='flex flex-col gap-2'>
                            <h2 className='py-1 border-b-[2px] border-white/10'>Workspace</h2>
                            <div className='flex flex-col gap-2'>
                                <button onClick={() => setTag('All')} className='w-full py-1 bg-[#262831] hover:bg-[#364155] rounded-full cursor-pointer'>All</button>
                                <button onClick={() => setTag('Favorite')} className='w-full py-1 bg-[#262831] hover:bg-[#364155] rounded-full cursor-pointer flex items-center justify-center gap-2'><FaHeart />Favorite</button>
                                {/* <button className='w-full py-1 bg-[#262831] hover:bg-[#364155] rounded-full cursor-pointer flex items-center justify-center gap-2'><FaPlus /> Add</button> */}
                            </div>
                        </div>
                    </aside>
                    <div className='w-full h-full pb-6'>
                        {
                            (!loading && !(newListOfBuckets) || (newListOfBuckets?.length === 0)) && <p className='px-4 place-self-center'>You have no buckets, yet!</p>
                        }
                        <BucketListContainer buckets={newListOfBuckets} />
                    </div>
                </main>
            </div >
        </div>
    );
}
export default Dashboard;

function BucketListContainer({ buckets }) {
    const [currentBucketMenu, setCurrentBucketMenu] = useState('');
    const [idOfSelectedBucket, setIdOfSelectedBucket] = useState('');

    return <div className="w-full h-auto flex flex-col gap-4">
        {
            buckets?.map((bucket) => {
                return <BucketCard
                    key={bucket.id}
                    bucket={bucket}
                    idOfSelectedBucket={idOfSelectedBucket}
                    setIdOfSelectedBucket={setIdOfSelectedBucket}
                    currentBucketMenu={currentBucketMenu}
                    setCurrentBucketMenu={setCurrentBucketMenu}
                />
            })
        }
    </div>
}