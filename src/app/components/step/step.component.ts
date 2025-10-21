import { Component, ElementRef, Input } from '@angular/core'
import BRStep from '@govbr-ds/core/dist/components/step/step'

@Component({
  selector: 'br-step',
  templateUrl: './step.component.html',
})
export class BRStepComponent {
  @Input() dataInitial: number = 1
  @Input() dataLabel: string = ''
  @Input() dataScroll: boolean = false
  @Input() dataType: string = ''
  @Input() dataOrientation: string = ''

  instance: any

  constructor(private brStep: ElementRef) {}
  ngAfterViewInit() {
    this.instance = new BRStep('.br-step', this.brStep.nativeElement.querySelector('.br-step'))
  }
}
