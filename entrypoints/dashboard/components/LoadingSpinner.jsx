import { ImSpinner2 } from "react-icons/im"

function LoadingSpinner({ loading }) {
    return (
        <>
            {
                loading && <div className='absolute top-1/2 left-1/2 -translate-1/2'>
                    <ImSpinner2 size={34} className='animate-spin' />
                </div>
            }
        </>
    )
}

export default LoadingSpinner