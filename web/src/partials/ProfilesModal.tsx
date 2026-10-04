import { type JSX, useEffect } from "react"
import { useLiveState } from "../hooks/useLiveState"
import Modal from "../components/Modal"
import styles from "~styles"
import { useLingui } from "#lingui"

export default function ProfilesModal(props: {
    visible: boolean
    onClose: () => void
    onSelect: (profile: ProfileInfo) => void
    loadProfiles: () => Promise<ProfileInfo[]>
}): JSX.Element {
    const [profiles, setProfiles] = useLiveState<ProfileInfo[] | undefined>(
        undefined,
    )
    const [failed, setFailed] = useLiveState(false)
    const { t } = useLingui()
    useEffect(() => {
        if (!props.visible) return
        let current = true
        setProfiles(undefined)
        setFailed(false)
        props
            .loadProfiles()
            .then((list) => {
                if (current) setProfiles(list)
            })
            .catch((error) => {
                if (current) {
                    console.error(error)
                    setProfiles([])
                    setFailed(true)
                }
            })
        return () => {
            current = false
        }
    }, [props.visible, props.loadProfiles, setProfiles, setFailed])
    return (
        <Modal visible={props.visible} onClose={props.onClose} backdropDismiss>
            <div className={styles.title}>{t`Profiles`}</div>
            <div className={styles.profiles}>
                {profiles() === undefined ? (
                    <div
                        className={styles.noResult}
                        role="status"
                    >{t`Loading profiles…`}</div>
                ) : failed() ? (
                    <div
                        className={styles.noResult}
                        role="alert"
                    >{t`Unable to load saved profiles. Please try again.`}</div>
                ) : profiles()!.length ? (
                    profiles()!.map((profile) => (
                        <button
                            type="button"
                            key={profile.id}
                            className={`${styles.profile} w-full text-left`}
                            onClick={() => props.onSelect(profile)}
                        >
                            <span className={styles.name}>{profile.name}</span>
                            <span className={styles.time}>
                                {new Date(profile.createdAt).toLocaleString()}
                            </span>
                        </button>
                    ))
                ) : (
                    <div
                        className={styles.noResult}
                    >{t`No saved profiles.`}</div>
                )}
            </div>
        </Modal>
    )
}
