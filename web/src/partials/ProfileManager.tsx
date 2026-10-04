import { useLiveState } from "../hooks/useLiveState"
import type { FC as Component } from "react"
import styles from "~styles"
import Button from "../components/Button"
import Modal from "../components/Modal"
import { useLingui } from "#lingui"
const ProfileManager: Component<{
    onLoad: () => void
    onSave?: () => void
    onNew?: () => void
    onClone?: () => void
    onClear?: () => void
    onDelete?: () => void
    disabled: boolean
    isLoaded: boolean
    isValid: boolean
}> = (props) => {
    const [clearModal, setClearModal] = useLiveState(false)
    const [deleteModal, setDeleteModal] = useLiveState(false)
    const [newModal, setNewModal] = useLiveState(false)
    const { t } = useLingui()
    return (
        <div className={styles.top}>
            {t`Profile:`}
            <Button onClick={props.onLoad} disabled={props.disabled}>
                {t`Load`}
            </Button>
            {props.onSave ? (
                <>
                    <Button
                        onClick={props.onSave}
                        disabled={props.disabled || !props.isValid}
                    >
                        {t`Save`}
                    </Button>
                </>
            ) : null}
            {props.isLoaded ? (
                <>
                    {props.onNew ? (
                        <>
                            <Button
                                onClick={() => setNewModal(true)}
                                disabled={props.disabled}
                            >
                                {t`New`}
                            </Button>
                        </>
                    ) : null}
                    {props.onClone ? (
                        <>
                            <Button
                                onClick={props.onClone}
                                disabled={props.disabled}
                            >
                                {t`Clone`}
                            </Button>
                        </>
                    ) : null}
                    {props.onClear ? (
                        <>
                            <Button
                                theme="error"
                                onClick={() => setClearModal(true)}
                                disabled={props.disabled}
                            >
                                {t`Clear`}
                            </Button>
                        </>
                    ) : null}
                    {props.onDelete ? (
                        <>
                            <Button
                                theme="error"
                                onClick={() => setDeleteModal(true)}
                                disabled={props.disabled}
                            >
                                {t`Delete`}
                            </Button>
                        </>
                    ) : null}
                </>
            ) : null}
            <Modal
                visible={clearModal()}
                onClose={() => setClearModal(false)}
                backdropDismiss
            >
                <div className={styles.modalTitle}>{t`Are you sure?`}</div>
                <div className={styles.warnText}>
                    {t`Do you really want to clear all progress? This cannot be undone.`}
                </div>
                <div className={styles.warnButtons}>
                    <Button
                        theme="error"
                        onClick={() => {
                            setClearModal(false)
                            props.onClear?.()
                        }}
                    >
                        {t`Clear`}
                    </Button>
                    <Button kind="outline" onClick={() => setClearModal(false)}>
                        {t`Cancel`}
                    </Button>
                </div>
            </Modal>
            <Modal
                visible={deleteModal()}
                onClose={() => setDeleteModal(false)}
                backdropDismiss
            >
                <div className={styles.modalTitle}>{t`Are you sure?`}</div>
                <div className={styles.warnText}>
                    {t`Do you really want to delete all settings and progress? This cannot be undone.`}
                </div>
                <div className={styles.warnButtons}>
                    <Button
                        theme="error"
                        onClick={() => {
                            setDeleteModal(false)
                            props.onDelete?.()
                        }}
                    >
                        {t`Delete`}
                    </Button>
                    <Button
                        kind="outline"
                        onClick={() => setDeleteModal(false)}
                    >
                        {t`Cancel`}
                    </Button>
                </div>
            </Modal>
            <Modal
                visible={newModal()}
                onClose={() => setNewModal(false)}
                backdropDismiss
            >
                <div className={styles.modalTitle}>{t`Are you sure?`}</div>
                <div className={styles.warnText}>
                    {t`Do you really want to create a new profile? All unsaved changes will be lost.`}
                </div>
                <div className={styles.warnButtons}>
                    <Button
                        onClick={() => {
                            setNewModal(false)
                            props.onNew?.()
                        }}
                    >
                        {t`Confirm`}
                    </Button>
                    <Button kind="outline" onClick={() => setNewModal(false)}>
                        {t`Cancel`}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
export default ProfileManager
